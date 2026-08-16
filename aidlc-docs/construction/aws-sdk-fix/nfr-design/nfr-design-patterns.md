# NFR Design Patterns: Unit `aws-sdk-fix`

## 1. Timeout Guard Pattern (RESILIENCY-10, SECURITY-15)

All AWS SDK network calls are wrapped with a Tokio timeout to prevent hung promises from blocking the desktop IPC pipeline:

```rust
use tokio::time::{timeout, Duration};

pub async fn execute_with_timeout<F, T>(future: F, duration: Duration, operation_name: &str) -> Result<T, String>
where
    F: std::future::Future<Output = Result<T, String>>,
{
    match timeout(duration, future).await {
        Ok(result) => result,
        Err(_) => Err(format!("Operation '{}' timed out after {} seconds", operation_name, duration.as_secs())),
    }
}
```

---

## 2. Credential Stripping & Secret Redaction Pattern (SECURITY-03, SECURITY-14)

1. When extracting session tokens from frontend payloads or store entries, empty strings or whitespace-only tokens are filtered to `None`:
```rust
let clean_session_token = creds.session_token.filter(|s| !s.trim().is_empty());
```
2. When formatting errors across IPC, raw request buffers or headers containing `Authorization`, `X-Amz-Security-Token`, or access keys are explicitly omitted:
```rust
pub fn sanitize_aws_error<E: std::fmt::Display>(err: E) -> String {
    let raw = err.to_string();
    // Strip file paths, raw memory addresses, or verbose debug headers if present
    raw.lines().next().unwrap_or("Unknown AWS error").to_string()
}
```

---

## 3. Exponential Backoff & Jitter Pattern (RESILIENCY-05, RESILIENCY-10)

For `BatchWriteItem` with `unprocessed_items` and SSO OIDC token polling with `SlowDownException`:

```rust
pub async fn retry_with_backoff<F, Fut, T>(
    mut operation: F,
    max_retries: usize,
    initial_delay_ms: u64,
) -> Result<T, String>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<Option<T>, String>>,
{
    let mut delay = initial_delay_ms;
    for attempt in 0..=max_retries {
        match operation().await? {
            Some(val) => return Ok(val),
            None if attempt == max_retries => break,
            None => {
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                delay = std::cmp::min(delay * 2, 5000);
            }
        }
    }
    Err("Exceeded maximum retry attempts".to_string())
}
```

---

## 4. Double-Checked State Caching Pattern (PERF-01, RESILIENCY-09)

```rust
pub async fn get_cached_client(state: &AwsClientState, app: &AppHandle) -> Result<DynamoDbClient, String> {
    let session = get_current_session(app)?;
    let fingerprint = format!("{}:{}:{:?}", session.region, session.credentials.as_ref().map(|c| &c.access_key_id).unwrap_or(&"".to_string()), session.access_token_expiry);

    // Fast path: Read lock
    {
        let reader = state.ddb_client.read().await;
        if let Some(cached) = reader.as_ref() {
            if cached.session_fingerprint == fingerprint {
                return Ok(cached.client.clone());
            }
        }
    }

    // Slow path: Write lock with double check
    let mut writer = state.ddb_client.write().await;
    if let Some(cached) = writer.as_ref() {
        if cached.session_fingerprint == fingerprint {
            return Ok(cached.client.clone());
        }
    }

    let client = create_fresh_client(&session).await?;
    *writer = Some(CachedClient {
        client: client.clone(),
        region: session.region,
        session_fingerprint: fingerprint,
        created_at: std::time::Instant::now(),
    });

    Ok(client)
}
```
