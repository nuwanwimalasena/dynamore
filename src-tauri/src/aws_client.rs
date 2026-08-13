use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_dynamodb::config::{Credentials, Region};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionCredentials {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub session_token: Option<String>,
    pub expiration: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone)]
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

pub async fn get_dynamodb_client(app: AppHandle) -> Result<DynamoDbClient, String> {
    let store = app.store("dynamore-auth").map_err(|e| e.to_string())?;
    
    let session_val = store.get("session").ok_or("Not authenticated")?;
    let session: SessionData = serde_json::from_value(session_val).map_err(|e| e.to_string())?;

    let creds = session.credentials.ok_or("No credentials found in session")?;

    let clean_session_token = creds.session_token.filter(|s| !s.trim().is_empty());

    let credentials = Credentials::new(
        creds.access_key_id,
        creds.secret_access_key,
        clean_session_token,
        creds.expiration.map(|e| std::time::SystemTime::UNIX_EPOCH + std::time::Duration::from_millis(e as u64)),
        "dynamore",
    );

    let sdk_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(Region::new(session.region))
        .credentials_provider(credentials)
        .load()
        .await;

    Ok(DynamoDbClient::new(&sdk_config))
}
