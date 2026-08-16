# Code Generation Plan: Unit `aws-sdk-fix`

## Purpose
This plan details the step-by-step implementation tasks to fix, optimize, and standardize all AWS SDK operations across the Rust backend and TypeScript frontend.

## Implementation Steps

- [x] **Step 1: Implement Managed AWS Client Cache in `src-tauri/src/aws_client.rs`**
  - Define `AwsClientState` and `CachedClient` with `tokio::sync::RwLock`.
  - Implement `get_dynamodb_client(state, app)` with double-checked caching logic.
  - Implement `invalidate_client(state)` to purge stale credentials on logout/region switch.
  - Robustly normalize credentials and strip empty session token strings.

- [x] **Step 2: Register Managed State in `src-tauri/src/main.rs`**
  - Register `AwsClientState::new()` into Tauri application state using `.manage()`.
  - Ensure all command handlers receive `tauri::State<'_, AwsClientState>` where needed.

- [x] **Step 3: Refactor & Harden Table Commands in `src-tauri/src/commands/tables.rs`**
  - Update `tables_list`, `tables_describe`, `tables_create`, `tables_delete` to return `Result<Value, String>` uniformly (returning `Err(err)` on failure instead of `Ok({ success: false })`).
  - Harden `parse_create_table_input` to correctly omit `ProvisionedThroughput` when `BillingMode == "PAY_PER_REQUEST"` and validate throughput on `PROVISIONED`.
  - Ensure `map_table_description` maps all table attributes, GSIs, LSIs, billing mode, and creation timestamps accurately.

- [x] **Step 4: Refactor & Harden Item CRUD Commands in `src-tauri/src/commands/items.rs`**
  - Update `items_put`, `items_get`, `items_update`, `items_delete`, and `items_batch_delete` with `serde_dynamo` attribute marshaling and typed error reporting.
  - Implement 25-item chunking in `items_batch_delete` with retry handling for unprocessed items.
  - Ensure `items_update` validates and correctly sets `ExpressionAttributeNames` and `ExpressionAttributeValues`.

- [x] **Step 5: Implement Multi-Page Accumulation in `src-tauri/src/commands/query.rs`**
  - Refactor `query_query` and `query_scan` to return `Result<QueryResult, String>`.
  - Implement the auto-pagination accumulation loop evaluating up to the target `limit` or maximum 10 pages when `FilterExpression` is used.
  - Return accumulated matching items, total scanned count, and final `LastEvaluatedKey`.

- [x] **Step 6: Refactor Authentication & Session Management in `src-tauri/src/commands/auth.rs`**
  - Update `auth_login_with_keys`, `auth_complete_sso_login`, and `auth_logout` to invalidate `AwsClientState` on session mutations.
  - Standardize error return types to native `Result<T, String>`.
  - Detect expired SSO tokens gracefully in `auth_get_session`.

- [x] **Step 7: Update Frontend IPC Bridge & Store Integrations**
  - Update `src/api.ts` method signatures and error handling.
  - Update `src/pages/LoginPage.tsx`, `src/pages/TableDetailPage.tsx`, `src/components/QueryBuilder.tsx`, `src/components/ScanBuilder.tsx`, and `src/components/ItemEditor.tsx` to handle standardized Promise rejections cleanly with user notifications.

- [x] **Step 8: Generate Code Generation Summary Artifact**
  - Create `aidlc-docs/construction/aws-sdk-fix/code/code-summary.md` documenting all modified files, error protocols, caching structures, and verification results.
