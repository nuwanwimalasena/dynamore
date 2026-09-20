use app_lib::aws_client::{SessionCredentials, SessionData};
use std::time::{SystemTime, UNIX_EPOCH};

fn clean_start_url(url: &str) -> String {
    let mut trimmed = url.trim();
    while trimmed.ends_with('/') || trimmed.ends_with('#') {
        trimmed = trimmed.trim_end_matches('/').trim_end_matches('#');
    }
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        format!("https://{}", trimmed)
    } else {
        trimmed.to_string()
    }
}

#[test]
fn test_clean_start_url_normalization() {
    assert_eq!(
        clean_start_url("my-sso.awsapps.com/start"),
        "https://my-sso.awsapps.com/start"
    );
    assert_eq!(
        clean_start_url("https://my-sso.awsapps.com/start/"),
        "https://my-sso.awsapps.com/start"
    );
    assert_eq!(
        clean_start_url("https://my-sso.awsapps.com/start/#/"),
        "https://my-sso.awsapps.com/start"
    );
    assert_eq!(
        clean_start_url("   https://my-sso.awsapps.com/start   "),
        "https://my-sso.awsapps.com/start"
    );
}

#[test]
fn test_session_expiration_detection() {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    // Case 1: Expired 5 minutes ago
    let expired_ms = now_ms - 300_000;
    let is_expired_1 = now_ms >= expired_ms.saturating_sub(60_000);
    assert!(is_expired_1, "Should detect already expired credentials");

    // Case 2: Expiring in 30 seconds (within the 60s safety buffer)
    let near_expiry_ms = now_ms + 30_000;
    let is_expired_2 = now_ms >= near_expiry_ms.saturating_sub(60_000);
    assert!(
        is_expired_2,
        "Should trigger proactive refresh within 60s window"
    );

    // Case 3: Valid for 2 hours
    let valid_ms = now_ms + 7_200_000;
    let is_expired_3 = now_ms >= valid_ms.saturating_sub(60_000);
    assert!(
        !is_expired_3,
        "Valid session should not be detected as expired"
    );
}

#[test]
fn test_session_fingerprinting() {
    let session = SessionData {
        auth_type: "keys".to_string(),
        region: "us-west-2".to_string(),
        account_id: None,
        role_name: None,
        access_token: None,
        access_token_expiry: None,
        start_url: None,
        credentials: Some(SessionCredentials {
            access_key_id: "AKIAIOSFODNN7EXAMPLE".to_string(),
            secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY".to_string(),
            session_token: Some("token_123".to_string()),
            expiration: Some(1700000000000),
        }),
    };

    let creds = session.credentials.as_ref().unwrap();
    let clean_token = creds
        .session_token
        .as_ref()
        .filter(|s| !s.trim().is_empty());
    let token_str = match clean_token {
        Some(t) => t.as_str(),
        None => "none",
    };
    let fingerprint = format!(
        "{}:{}:{}:{}",
        session.region.trim(),
        creds.access_key_id.trim(),
        token_str,
        creds.expiration.unwrap_or(0)
    );

    assert_eq!(
        fingerprint,
        "us-west-2:AKIAIOSFODNN7EXAMPLE:token_123:1700000000000"
    );
}

#[test]
fn test_region_switch_fingerprint_change() {
    let mut session = SessionData {
        auth_type: "keys".to_string(),
        region: "us-east-1".to_string(),
        account_id: None,
        role_name: None,
        access_token: None,
        access_token_expiry: None,
        start_url: None,
        credentials: Some(SessionCredentials {
            access_key_id: "AKIAIOSFODNN7EXAMPLE".to_string(),
            secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY".to_string(),
            session_token: None,
            expiration: None,
        }),
    };

    let fp1 = format!(
        "{}:{}",
        session.region,
        session.credentials.as_ref().unwrap().access_key_id
    );
    assert_eq!(fp1, "us-east-1:AKIAIOSFODNN7EXAMPLE");

    // Switch region to eu-west-1
    session.region = "eu-west-1".to_string();
    let fp2 = format!(
        "{}:{}",
        session.region,
        session.credentials.as_ref().unwrap().access_key_id
    );
    assert_eq!(fp2, "eu-west-1:AKIAIOSFODNN7EXAMPLE");
    assert_ne!(
        fp1, fp2,
        "Fingerprint must change when region switches to invalidate cache"
    );
}
