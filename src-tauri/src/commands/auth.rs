use aws_sdk_sso::{config::Region as SsoRegion, Client as SsoClient};
use aws_sdk_ssooidc::{config::Region as SsoOidcRegion, Client as SsoOidcClient};
use aws_sdk_sts::{config::Region as StsRegion, Client as StsClient};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State, Window};
use tauri_plugin_store::StoreExt;

use crate::aws_client::{
    sanitize_error_message, AwsClientState, SessionCredentials, SessionData,
};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LastSsoConfig {
    pub start_url: String,
    pub region: String,
    pub account_id: String,
    pub role_name: String,
}

#[tauri::command]
pub async fn auth_get_last_sso_config(app: AppHandle) -> Result<Option<LastSsoConfig>, String> {
    let store = app.store("dynamore-config").map_err(|e| e.to_string())?;
    let config = store
        .get("lastSSOConfig")
        .and_then(|v| serde_json::from_value(v).ok());
    Ok(config)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SsoInitResponse {
    pub client_id: String,
    pub client_secret: String,
    pub device_code: String,
    pub interval: u64,
    pub expires_at: u64,
    pub start_url: String,
    pub region: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    step: String,
    message: String,
}

fn clean_start_url(url: &str) -> String {
    let trimmed = url
        .trim()
        .trim_end_matches('/')
        .trim_end_matches("#/")
        .trim_end_matches('/');
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        format!("https://{}", trimmed)
    } else {
        trimmed.to_string()
    }
}

fn send_progress(window: &Window, step: &str, message: &str) {
    let _ = window.emit(
        "auth:ssoProgress",
        ProgressPayload {
            step: step.to_string(),
            message: message.to_string(),
        },
    );
}

async fn create_sso_oidc_client(region_str: &str) -> SsoOidcClient {
    let sdk_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(SsoOidcRegion::new(region_str.to_string()))
        .load()
        .await;
    SsoOidcClient::new(&sdk_config)
}

#[tauri::command]
pub async fn auth_init_sso(
    app: AppHandle,
    window: Window,
    start_url: String,
    region: String,
) -> Result<SsoInitResponse, String> {
    let start_url = clean_start_url(&start_url);

    let store = app.store("dynamore-config").map_err(|e| e.to_string())?;
    let config = LastSsoConfig {
        start_url: start_url.clone(),
        region: region.clone(),
        account_id: "".to_string(),
        role_name: "".to_string(),
    };
    store.set(
        "lastSSOConfig",
        serde_json::to_value(config).map_err(|e| e.to_string())?,
    );

    send_progress(&window, "registering", "Registering with AWS SSO…");

    let mut active_region = region.clone();
    let mut oidc_client = create_sso_oidc_client(&active_region).await;

    let mut register_res = oidc_client
        .register_client()
        .client_name("dynamore")
        .client_type("public")
        .send()
        .await;

    if register_res.is_err() && active_region != "us-east-1" {
        let fallback_client = create_sso_oidc_client("us-east-1").await;
        if let Ok(reg) = fallback_client
            .register_client()
            .client_name("dynamore")
            .client_type("public")
            .send()
            .await
        {
            oidc_client = fallback_client;
            active_region = "us-east-1".to_string();
            register_res = Ok(reg);
        }
    }

    let register_res = register_res.map_err(|e| format!("SSO registration error: {}", e))?;
    let client_id = register_res.client_id().unwrap_or_default().to_string();
    let client_secret = register_res
        .client_secret()
        .unwrap_or_default()
        .to_string();

    send_progress(&window, "authorizing", "Opening browser for sign-in…");

    let auth_res = oidc_client
        .start_device_authorization()
        .client_id(&client_id)
        .client_secret(&client_secret)
        .start_url(&start_url)
        .send()
        .await;

    if auth_res.is_err() && active_region != "us-east-1" {
        let fallback_client = create_sso_oidc_client("us-east-1").await;
        if let Ok(reg) = fallback_client
            .register_client()
            .client_name("dynamore")
            .client_type("public")
            .send()
            .await
        {
            let cid = reg.client_id().unwrap_or_default().to_string();
            let csec = reg.client_secret().unwrap_or_default().to_string();
            let fb_auth = fallback_client
                .start_device_authorization()
                .client_id(&cid)
                .client_secret(&csec)
                .start_url(&start_url)
                .send()
                .await;
            if let Ok(auth_data) = fb_auth {
                let device_code = auth_data.device_code().unwrap_or_default().to_string();
                let interval = (auth_data.interval() as u64) * 1000;
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;
                let expires_at = now + (auth_data.expires_in() as u64) * 1000;
                if let Some(uri) = auth_data.verification_uri_complete() {
                    let _ = open::that(uri);
                }
                return Ok(SsoInitResponse {
                    client_id: cid,
                    client_secret: csec,
                    device_code,
                    interval,
                    expires_at,
                    start_url,
                    region: "us-east-1".to_string(),
                });
            }
        }
    }

    let auth_res = auth_res.map_err(|e| format!("Device authorization error: {}", e))?;
    let device_code = auth_res.device_code().unwrap_or_default().to_string();
    let interval = (auth_res.interval() as u64) * 1000;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
    let expires_at = now + (auth_res.expires_in() as u64) * 1000;

    if let Some(uri) = auth_res.verification_uri_complete() {
        let _ = open::that(uri);
    }

    Ok(SsoInitResponse {
        client_id,
        client_secret,
        device_code,
        interval,
        expires_at,
        start_url,
        region: active_region,
    })
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SsoTokenResponse {
    pub access_token: String,
}

#[tauri::command]
pub async fn auth_poll_sso_token(
    window: Window,
    region: String,
    client_id: String,
    client_secret: String,
    device_code: String,
    interval: u64,
    expires_at: u64,
) -> Result<SsoTokenResponse, String> {
    send_progress(&window, "polling", "Waiting for browser sign-in to complete…");

    let sdk_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(SsoOidcRegion::new(region.clone()))
        .load()
        .await;
    let oidc_client = SsoOidcClient::new(&sdk_config);

    let poll_interval = std::cmp::max(interval, 3000);

    loop {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        if now >= expires_at {
            break;
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(poll_interval)).await;

        let token_res = oidc_client
            .create_token()
            .client_id(&client_id)
            .client_secret(&client_secret)
            .grant_type("urn:ietf:params:oauth:grant-type:device_code")
            .device_code(&device_code)
            .send()
            .await;

        match token_res {
            Ok(res) => {
                if let Some(access_token) = res.access_token() {
                    send_progress(
                        &window,
                        "authenticated",
                        "Signed in! Fetching your accounts…",
                    );
                    return Ok(SsoTokenResponse {
                        access_token: access_token.to_string(),
                    });
                }
            }
            Err(sdk_err) => {
                let is_pending_or_slowdown = match &sdk_err {
                    aws_sdk_ssooidc::error::SdkError::ServiceError(context) => {
                        context.err().is_authorization_pending_exception()
                            || context.err().is_slow_down_exception()
                    }
                    _ => false,
                };

                let debug_str = format!("{:?}", sdk_err);
                let is_str_pending = debug_str.contains("AuthorizationPendingException")
                    || debug_str.contains("SlowDownException")
                    || debug_str.contains("authorization_pending")
                    || debug_str.contains("slow_down");

                if is_pending_or_slowdown || is_str_pending {
                    continue;
                }

                return Err(format!("Token polling error: {:?}", sdk_err));
            }
        }
    }

    Err("Login timed out. Please try again.".to_string())
}

async fn create_sso_client(region_str: &str) -> SsoClient {
    let sdk_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(SsoRegion::new(region_str.to_string()))
        .load()
        .await;
    SsoClient::new(&sdk_config)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SsoAccountsResponse {
    pub accounts: Vec<Value>,
}

#[tauri::command]
pub async fn auth_list_sso_accounts(
    access_token: String,
    region: String,
) -> Result<SsoAccountsResponse, String> {
    let sso_client = create_sso_client(&region).await;

    let mut res = sso_client
        .list_accounts()
        .access_token(&access_token)
        .send()
        .await;

    if res.is_err() && region != "us-east-1" {
        let fallback_client = create_sso_client("us-east-1").await;
        let fb_res = fallback_client
            .list_accounts()
            .access_token(&access_token)
            .send()
            .await;
        if fb_res.is_ok() {
            res = fb_res;
        }
    }

    let res = res.map_err(|e| format!("List accounts error: {}", e))?;

    let accounts = res
        .account_list()
        .iter()
        .map(|a| {
            serde_json::json!({
                "accountId": a.account_id(),
                "accountName": a.account_name(),
                "emailAddress": a.email_address()
            })
        })
        .collect();

    Ok(SsoAccountsResponse { accounts })
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SsoRolesResponse {
    pub roles: Vec<Value>,
}

#[tauri::command]
pub async fn auth_list_sso_account_roles(
    access_token: String,
    region: String,
    account_id: String,
) -> Result<SsoRolesResponse, String> {
    let sso_client = create_sso_client(&region).await;

    let mut res = sso_client
        .list_account_roles()
        .access_token(&access_token)
        .account_id(&account_id)
        .send()
        .await;

    if res.is_err() && region != "us-east-1" {
        let fallback_client = create_sso_client("us-east-1").await;
        let fb_res = fallback_client
            .list_account_roles()
            .access_token(&access_token)
            .account_id(&account_id)
            .send()
            .await;
        if fb_res.is_ok() {
            res = fb_res;
        }
    }

    let res = res.map_err(|e| format!("List account roles error: {}", e))?;

    let roles = res
        .role_list()
        .iter()
        .map(|r| {
            serde_json::json!({
                "roleName": r.role_name(),
                "accountId": r.account_id()
            })
        })
        .collect();

    Ok(SsoRolesResponse { roles })
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteSsoLoginResponse {
    pub success: bool,
    pub account_id: String,
    pub role_name: String,
    pub region: String,
}

#[tauri::command]
pub async fn auth_complete_sso_login(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    access_token: String,
    region: String,
    sso_region: Option<String>,
    account_id: String,
    role_name: String,
    start_url: String,
) -> Result<CompleteSsoLoginResponse, String> {
    let portal_region = sso_region.as_deref().unwrap_or(&region);
    let sso_client = create_sso_client(portal_region).await;

    let mut res = sso_client
        .get_role_credentials()
        .access_token(&access_token)
        .account_id(&account_id)
        .role_name(&role_name)
        .send()
        .await;

    if res.is_err() && portal_region != "us-east-1" {
        let fallback_client = create_sso_client("us-east-1").await;
        let fb_res = fallback_client
            .get_role_credentials()
            .access_token(&access_token)
            .account_id(&account_id)
            .role_name(&role_name)
            .send()
            .await;
        if fb_res.is_ok() {
            res = fb_res;
        }
    }

    let res = res.map_err(|e| format!("Get role credentials error: {}", e))?;
    let creds = res.role_credentials().ok_or("No credentials returned")?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let session = SessionData {
        auth_type: "sso".to_string(),
        access_token: Some(access_token),
        access_token_expiry: Some(now + 8 * 3600_000),
        credentials: Some(SessionCredentials {
            access_key_id: creds.access_key_id().unwrap_or_default().to_string(),
            secret_access_key: creds.secret_access_key().unwrap_or_default().to_string(),
            session_token: creds.session_token().map(|s| s.to_string()),
            expiration: Some(creds.expiration() as u64),
        }),
        start_url: Some(start_url.clone()),
        region: region.clone(),
        account_id: Some(account_id.clone()),
        role_name: Some(role_name.clone()),
    };

    let auth_store = app.store("dynamore-auth").map_err(|e| e.to_string())?;
    auth_store.set(
        "session",
        serde_json::to_value(&session).map_err(|e| e.to_string())?,
    );

    let config_store = app.store("dynamore-config").map_err(|e| e.to_string())?;
    let config = LastSsoConfig {
        start_url,
        region: region.clone(),
        account_id: account_id.clone(),
        role_name: role_name.clone(),
    };
    config_store.set(
        "lastSSOConfig",
        serde_json::to_value(config).map_err(|e| e.to_string())?,
    );

    // Invalidate cached client to force refresh with new session credentials
    state.invalidate().await;

    Ok(CompleteSsoLoginResponse {
        success: true,
        account_id,
        role_name,
        region,
    })
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogoutResponse {
    pub success: bool,
}

#[tauri::command]
pub async fn auth_logout(
    state: State<'_, AwsClientState>,
    app: AppHandle,
) -> Result<LogoutResponse, String> {
    let auth_store = app.store("dynamore-auth").map_err(|e| e.to_string())?;
    auth_store.delete("session");
    state.invalidate().await;
    Ok(LogoutResponse { success: true })
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionResponse {
    pub auth_type: String,
    pub account_id: Option<String>,
    pub role_name: Option<String>,
    pub region: String,
}

#[tauri::command]
pub async fn auth_get_session(
    state: State<'_, AwsClientState>,
    app: AppHandle,
) -> Result<Option<SessionResponse>, String> {
    let auth_store = app.store("dynamore-auth").map_err(|e| e.to_string())?;

    if let Some(val) = auth_store.get("session") {
        if let Ok(session) = serde_json::from_value::<SessionData>(val.clone()) {
            if session.auth_type == "sso" {
                if let Some(creds) = &session.credentials {
                    if let Some(exp) = creds.expiration {
                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as u64;
                        if now > exp.saturating_sub(60_000) {
                            auth_store.delete("session");
                            state.invalidate().await;
                            return Ok(None);
                        }
                    }
                }
            }
            return Ok(Some(SessionResponse {
                auth_type: session.auth_type,
                account_id: session.account_id,
                role_name: session.role_name,
                region: session.region,
            }));
        }
    }

    Ok(None)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginWithKeysResponse {
    pub success: bool,
    pub region: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn auth_login_with_keys(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    access_key_id: String,
    secret_access_key: String,
    session_token: Option<String>,
    region: String,
) -> Result<LoginWithKeysResponse, String> {
    let clean_session_token = session_token.clone().filter(|s| !s.trim().is_empty());

    let credentials = aws_credential_types::Credentials::new(
        access_key_id.clone(),
        secret_access_key.clone(),
        clean_session_token.clone(),
        None,
        "dynamore",
    );

    let region_str = if region.trim().is_empty() {
        "us-east-1".to_string()
    } else {
        region.trim().to_string()
    };

    let sdk_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(StsRegion::new(region_str.clone()))
        .credentials_provider(credentials)
        .load()
        .await;

    let sts_client = StsClient::new(&sdk_config);

    match sts_client.get_caller_identity().send().await {
        Ok(_) => {
            let session = SessionData {
                auth_type: "keys".to_string(),
                access_token: None,
                access_token_expiry: None,
                credentials: Some(SessionCredentials {
                    access_key_id,
                    secret_access_key,
                    session_token: clean_session_token,
                    expiration: None,
                }),
                start_url: None,
                region: region_str.clone(),
                account_id: None,
                role_name: None,
            };

            let auth_store = app.store("dynamore-auth").map_err(|e| e.to_string())?;
            auth_store.set(
                "session",
                serde_json::to_value(&session).map_err(|e| e.to_string())?,
            );

            state.invalidate().await;

            Ok(LoginWithKeysResponse {
                success: true,
                region: Some(region_str),
                error: None,
            })
        }
        Err(err) => {
            let error_msg = sanitize_error_message(err);
            Ok(LoginWithKeysResponse {
                success: false,
                region: None,
                error: Some(error_msg),
            })
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearSsoConfigResponse {
    pub success: bool,
}

#[tauri::command]
pub async fn auth_clear_sso_config(app: AppHandle) -> Result<ClearSsoConfigResponse, String> {
    let config_store = app.store("dynamore-config").map_err(|e| e.to_string())?;
    config_store.delete("lastSSOConfig");
    Ok(ClearSsoConfigResponse { success: true })
}
