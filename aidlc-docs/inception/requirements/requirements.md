# Requirements Document: AWS SDK Operations Revisit & Bug Fix

## Intent Analysis Summary
- **User Request**: Revisit all AWS SDK calls across the application to diagnose and resolve operational discrepancies.
- **Request Type**: Bug Fix / Reliability Enhancement
- **Initial Scope Estimate**: System-wide (Rust Tauri IPC handlers, AWS Client Factory, Frontend IPC bridge, and Store integrations)
- **Initial Complexity Estimate**: Moderate to Complex
- **Requirements Depth**: Standard Depth

---

## Background & Problem Statement
Dynamore interacts with AWS via the official AWS Rust SDKs (`aws-sdk-dynamodb`, `aws-sdk-sso`, `aws-sdk-ssooidc`, `aws-sdk-sts`). Currently, several operational inconsistencies and failure modes exist across the stack:
1. **Inconsistent Error Envelopes**: Some IPC handlers return `Ok({ "success": false, "error": ... })` while others return `Err(...)`, creating mixed and unhandled error handling across frontend promises.
2. **DynamoDB Expression Attribute Typing & Marshaling**: `UpdateItem`, `Query`, and `Scan` commands convert raw JSON values to DynamoDB `AttributeValue` via `serde_dynamo` without proper type coercion or empty string sanitization, causing validation exceptions (`SerializationException` / `ValidationException`).
3. **Filter vs. Limit Pagination Discrepancy**: In `Query` and `Scan`, DynamoDB applies `Limit` *before* evaluating `FilterExpression`. This causes queries with filters to return empty or short result lists even when more matching items exist, leaving pagination incomplete.
4. **Client Lifecycle Overhead**: AWS SDK clients and configurations are reconstructed on every single IPC invocation instead of being cached in managed application state per active session.
5. **Table Schema & CRUD Edge Cases**: Schema attribute parsing during table creation lacks complete validation for on-demand billing modes, and batch item deletes do not handle partial failures / unprocessed items gracefully.

---

## Functional Requirements (FR)

### FR-1: IPC Error Protocol & Response Contract Standardization
- **FR-1.1**: Standardize all Tauri command handlers (`auth_*`, `tables_*`, `items_*`, `query_*`) to return native Rust `Result<T, String>`.
- **FR-1.2**: On success, handlers must return typed data payloads directly (e.g., `Vec<String>` for `tables_list`, `TableDescription` for `tables_describe`, `QueryResult` for queries/scans, `()` or `{ success: true }` for mutations).
- **FR-1.3**: On failure, handlers must return `Err(String)` containing clean, human-readable error descriptions with AWS error codes where available.
- **FR-1.4**: Standardize frontend [`src/api.ts`](file:///development/foss/dynamore/src/api.ts) wrapper methods so that all IPC failures reject the Promise naturally, allowing unified `try/catch` and UI notification handling in React.

### FR-2: AWS SDK Client Lifecycle & Managed Caching
- **FR-2.1**: Implement a managed AWS client cache within Tauri managed state (`tauri::State<AwsClientState>`).
- **FR-2.2**: The cache must maintain an instantiated, pre-configured `DynamoDbClient` tied to the active authentication session and AWS region.
- **FR-2.3**: Invalidate and reconstruct the cached client automatically upon:
  - User login (SSO or IAM Keys)
  - User logout
  - Region switch
  - Session credential expiration
- **FR-2.4**: Eliminate redundant `aws_config::defaults().load().await` calls on every command invocation.

### FR-3: Schema-Aware AttributeValue Marshaling & Sanitization
- **FR-3.1**: Implement robust, safe conversion from frontend JSON values to DynamoDB `AttributeValue` structures across `items_put`, `items_update`, `query_query`, and `query_scan`.
- **FR-3.2**: Automatically sanitize inputs:
  - Clean empty string tokens in credentials and session values.
  - Correctly distinguish between numeric values, boolean flags, string sets, number sets, and nested map/list document types.
  - Return clear, actionable validation error messages if attribute values or keys fail conversion.
- **FR-3.3**: Ensure `UpdateExpression`, `ExpressionAttributeNames`, and `ExpressionAttributeValues` in `items_update` are validated and correctly bound to `aws_sdk_dynamodb::operation::update_item::UpdateItemFluentBuilder`.

### FR-4: Query and Scan Auto-Pagination & Accumulation
- **FR-4.1**: In `query_query` and `query_scan`, when a user specifies a `limit` along with a `filter_expression`:
  - Implement an internal accumulation loop in Rust that repeatedly evaluates the query/scan using `exclusive_start_key` until either:
    1. The accumulated number of matching items reaches the requested `limit`, OR
    2. The table/index scan reaches the end of data (`LastEvaluatedKey` is `None`), OR
    3. A safety page cap (e.g., 10 evaluation iterations) is reached to prevent unbounded scanning.
- **FR-4.2**: Return the accumulated items, total evaluated/scanned count, and the final `last_evaluated_key` (if any remains) to allow continuous next-page loading from the UI.
- **FR-4.3**: Preserve `scan_index_forward` ordering (ascending/descending) during multi-page accumulation.

### FR-5: Table Management & Schema Robustness
- **FR-5.1**: `tables_describe`: Map complete table metadata including Billing Mode (`PAY_PER_REQUEST` vs `PROVISIONED`), Provisioned Throughput, Key Schema (HASH and RANGE), Attribute Definitions, Global Secondary Indexes (GSIs), Local Secondary Indexes (LSIs), Table Size, and Item Count without dropping attributes.
- **FR-5.2**: `tables_create`: Robustly parse `create_table` inputs, supporting:
  - HASH and HASH+RANGE key schemas
  - Secondary index definitions (GSI and LSI) with projection types (`ALL`, `KEYS_ONLY`, `INCLUDE`)
  - Billing Mode switching (automatically omitting Provisioned Throughput when `PAY_PER_REQUEST` is selected, and enforcing throughput when `PROVISIONED` is selected).
- **FR-5.3**: `tables_delete`: Execute table deletion with verified error reporting.

### FR-6: Item CRUD & Batch Operations Robustness
- **FR-6.1**: `items_put`: Validate item payloads and write items using `put_item()`.
- **FR-6.2**: `items_get`: Retrieve items by primary key and deserialize them into clean JSON objects.
- **FR-6.3**: `items_delete`: Delete single items by key with accurate confirmation.
- **FR-6.4**: `items_batch_delete`: Chunk deletion requests into batches of up to 25 items (DynamoDB `BatchWriteItem` limit), verify execution for all chunks, and report total deleted item counts.

### FR-7: Authentication & Session Resilience
- **FR-7.1**: Direct Key Login (`auth_login_with_keys`): Verify credentials with STS `GetCallerIdentity`, sanitize empty session tokens, and persist active session.
- **FR-7.2**: SSO Device Flow (`auth_init_sso`, `auth_poll_sso_token`): Handle OIDC client registration, device code polling with exponential backoff, proper detection of `AuthorizationPendingException` and `SlowDownException`, and multi-region fallback (`user region` → `us-east-1`).
- **FR-7.3**: Session Expiration: Detect expired SSO credentials in `auth_get_session` gracefully and notify the user to re-authenticate without crashing the app.

---

## Non-Functional Requirements (NFR)

### NFR-1: Security Baseline (Enforced per Opt-In)
- **SECURITY-01**: All communication with AWS endpoints must use TLS 1.2+ encryption in transit.
- **SECURITY-03 & SECURITY-14**: Sensitive credentials (Access Keys, Secret Keys, Session Tokens, SSO Access Tokens) must NEVER be output in application logs, error messages, or terminal console output.
- **SECURITY-05**: All IPC parameters and DynamoDB input parameters must be strictly validated for type, length, and format before sending to AWS.
- **SECURITY-09**: Error responses presented to the user must be clean and informative without exposing internal system paths or raw memory dumps.
- **SECURITY-15**: All external async AWS SDK invocations must have robust error handling (no unhandled async panics or promise rejections).

### NFR-2: Resiliency Baseline (Enforced per Opt-In)
- **RESILIENCY-05 & RESILIENCY-06**: Deep error inspection distinguishing retryable network/throttling errors (`ProvisionedThroughputExceededException`, `RequestLimitExceeded`) from terminal client errors (`ResourceNotFoundException`, `ValidationException`).
- **RESILIENCY-10**: Explicit timeouts configured on all network-facing AWS SDK operations (avoiding indefinite hung promises).
- **RESILIENCY-15**: Fail-safe defaults across all IPC boundaries.

### NFR-3: Performance & Responsiveness
- Client instantiation overhead reduced to zero for recurring operations via cached client state.
- Query/Scan responses streamed over IPC efficiently using fast zero-copy serialization.

---

## Traceability Matrix

| Requirement | Target Components | Verification Method |
| :--- | :--- | :--- |
| **FR-1**: Error Protocol | `src-tauri/src/commands/*`, `src/api.ts` | Unit / IPC contract testing |
| **FR-2**: Client Cache | `src-tauri/src/aws_client.rs`, `main.rs` | Session lifecycle tests |
| **FR-3**: Attribute Marshaling | `commands/items.rs`, `commands/query.rs` | Type conversion tests (numbers, bools, maps) |
| **FR-4**: Pagination & Filter | `commands/query.rs`, `QueryBuilder.tsx` | Filter + Limit accumulation test |
| **FR-5**: Table Management | `commands/tables.rs`, `TableDetailPage.tsx` | Describe & Create table tests |
| **FR-6**: Item CRUD & Batch | `commands/items.rs`, `ResultsGrid.tsx` | Put/Get/Update/Delete/BatchDelete tests |
| **FR-7**: Auth & Session | `commands/auth.rs`, `LoginPage.tsx` | SSO & Keys authentication tests |
| **NFR-1 / NFR-2**: Sec & Res | All Backend Handlers | Security & Resiliency compliance checks |
