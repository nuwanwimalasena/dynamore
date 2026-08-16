# Non-Functional Requirements: Unit `aws-sdk-fix`

## 1. Security Requirements (Baseline Enforced)

### SEC-01: Encryption in Transit (SECURITY-01)
- All network communications with AWS APIs (DynamoDB, STS, SSO, SSO-OIDC) must use HTTPS over TLS 1.2+.

### SEC-02: Zero Credential Logging & Leakage (SECURITY-03, SECURITY-14)
- Sensitive credentials—including `access_key_id`, `secret_access_key`, `session_token`, and SSO bearer tokens—must NEVER be emitted to stdout/stderr, log files, or IPC error messages.
- The `dynamore-auth` store on disk must store credentials securely and isolate them from unprivileged renderer access.

### SEC-03: Input Validation & Sanitization (SECURITY-05)
- All IPC inputs (table names, keys, filter expressions, expression values) must undergo format and boundary validation before being passed into AWS SDK fluent builders.

### SEC-04: Sanitized Error Reporting (SECURITY-09, SECURITY-15)
- Error strings returned across IPC must convey the AWS service error code and user-actionable message without leaking local machine file paths, internal memory pointers, or raw stack traces.

---

## 2. Resiliency Requirements (Baseline Enforced)

### RES-01: Explicit Timeouts & Hung Request Prevention (RESILIENCY-10)
- All asynchronous AWS SDK calls must run within Tokio async contexts with reasonable timeouts (e.g. 15s for metadata operations, 30s for large table scans/queries, 60s for batch writes).

### RES-02: Exponential Backoff & Retry Handling (RESILIENCY-05, RESILIENCY-10)
- Batch write operations (`BatchWriteItem`) must detect `unprocessed_items` and perform up to 3 retry attempts with exponential backoff and jitter.
- SSO token polling must handle `SlowDownException` and `AuthorizationPendingException` by respecting server-specified intervals ($\ge 3000\text{ms}$).

### RES-03: Controlled Pagination Bounds (RESILIENCY-09)
- Queries and scans with filters must cap accumulation loops to 10 iterations per IPC call to protect client CPU and network bandwidth against pathological filter scans.

---

## 3. Performance & Maintainability Requirements

### PERF-01: Zero Redundant SDK Config Initializations
- Caching `DynamoDbClient` in `tauri::State` avoids the 100-300ms overhead of `aws_config::load()` on every single command execution.

### MAINT-01: Uniform Error Contract
- Uniform `Result<T, String>` signature across all 12+ IPC handlers ensures maintainable, predictable frontend Promise consumption.
