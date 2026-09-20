use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_dynamodb::config::{Credentials, Region};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use tokio::sync::RwLock;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SessionCredentials {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub session_token: Option<String>,
    pub expiration: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SessionData {
    pub auth_type: String,
    pub region: String,
    pub account_id: Option<String>,
    pub role_name: Option<String>,
    pub access_token: Option<String>,
    pub access_token_expiry: Option<u64>,
    pub start_url: Option<String>,
    pub credentials: Option<SessionCredentials>,
}

#[derive(Clone)]
#[allow(dead_code)]
pub struct CachedClient {
    pub client: DynamoDbClient,
    pub region: String,
    pub fingerprint: String,
    pub created_at: Instant,
}

#[derive(Default)]
pub struct AwsClientState {
    pub ddb_client: Arc<RwLock<Option<CachedClient>>>,
}

impl AwsClientState {
    pub fn new() -> Self {
        Self {
            ddb_client: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn invalidate(&self) {
        let mut writer = self.ddb_client.write().await;
        *writer = None;
    }
}

pub fn sanitize_error_message(err: impl std::error::Error) -> String {
    let mut messages = Vec::new();
    let root = err.to_string();
    if !root.is_empty() && root != "service error" && root != "operation error" {
        messages.push(root);
    }

    let mut current = err.source();
    while let Some(src) = current {
        let src_str = src.to_string();
        if !src_str.is_empty()
            && src_str != "service error"
            && src_str != "operation error"
            && !messages.contains(&src_str)
        {
            messages.push(src_str);
        }
        current = src.source();
    }

    if messages.is_empty() {
        format!("{:?}", err)
    } else {
        messages.join(": ")
    }
}

pub async fn get_dynamodb_client(
    state: &AwsClientState,
    app: &AppHandle,
) -> Result<DynamoDbClient, crate::error::AppError> {
    let store = app
        .store("dynamore-auth")
        .map_err(|e| crate::error::AppError::Auth(format!("Failed to open auth store: {}", e)))?;

    let session_val = store
        .get("session")
        .ok_or_else(|| crate::error::AppError::Auth("Not authenticated. Please log in.".to_string()))?;
    let session: SessionData = serde_json::from_value(session_val)
        .map_err(|e| crate::error::AppError::Auth(format!("Invalid session data: {}", e)))?;

    let creds = session
        .credentials
        .ok_or_else(|| crate::error::AppError::Auth("No credentials found in active session.".to_string()))?;

    // Check expiration for temporary credentials (SSO or STS assume-role)
    if let Some(exp_ms) = creds.expiration {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        if now_ms >= exp_ms.saturating_sub(60_000) {
            state.invalidate().await;
            return Err(crate::error::AppError::Auth(
                "Session has expired. Please log in again.".to_string(),
            ));
        }
    }

    let clean_session_token = creds.session_token.filter(|s| !s.trim().is_empty());
    let token_fingerprint = clean_session_token.as_deref().unwrap_or("none");
    let fingerprint = format!(
        "{}:{}:{}:{}",
        session.region.trim(),
        creds.access_key_id.trim(),
        token_fingerprint,
        creds.expiration.unwrap_or(0)
    );

    // Fast path: Check read lock
    {
        let reader = state.ddb_client.read().await;
        if let Some(cached) = reader.as_ref() {
            if cached.fingerprint == fingerprint {
                return Ok(cached.client.clone());
            }
        }
    }

    // Slow path: Acquire write lock and construct new client
    let mut writer = state.ddb_client.write().await;
    if let Some(cached) = writer.as_ref() {
        if cached.fingerprint == fingerprint {
            return Ok(cached.client.clone());
        }
    }

    let credentials = Credentials::new(
        creds.access_key_id.trim(),
        creds.secret_access_key.trim(),
        clean_session_token,
        creds.expiration.map(|e| UNIX_EPOCH + Duration::from_millis(e)),
        "dynamore",
    );

    let region_str = if session.region.trim().is_empty() {
        "us-east-1".to_string()
    } else {
        session.region.trim().to_string()
    };

    let sdk_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(Region::new(region_str.clone()))
        .credentials_provider(credentials)
        .load()
        .await;

    let client = DynamoDbClient::new(&sdk_config);

    *writer = Some(CachedClient {
        client: client.clone(),
        region: region_str,
        fingerprint,
        created_at: Instant::now(),
    });

    Ok(client)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug)]
    struct CustomError(&'static str);

    impl std::fmt::Display for CustomError {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(f, "{}", self.0)
        }
    }

    impl std::error::Error for CustomError {}

    #[derive(Debug)]
    struct NestedError {
        msg: &'static str,
        source: CustomError,
    }

    impl std::fmt::Display for NestedError {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(f, "{}", self.msg)
        }
    }

    impl std::error::Error for NestedError {
        fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
            Some(&self.source)
        }
    }

    #[test]
    fn test_sanitize_error_message_unwraps_source_chain() {
        let err = NestedError {
            msg: "service error",
            source: CustomError("ValidationException: Number of attributes in KeySchema does not match AttributeDefinitions"),
        };

        let result = sanitize_error_message(err);
        assert_eq!(
            result,
            "ValidationException: Number of attributes in KeySchema does not match AttributeDefinitions"
        );
    }

    #[test]
    fn test_empty_session_token_pruning() {
        let token_empty = Some("   ".to_string());
        let clean = token_empty.filter(|s| !s.trim().is_empty());
        assert_eq!(clean, None);

        let token_valid = Some(" valid-token-123 ".to_string());
        let clean_valid = token_valid.filter(|s| !s.trim().is_empty());
        assert_eq!(clean_valid, Some(" valid-token-123 ".to_string()));
    }
}

