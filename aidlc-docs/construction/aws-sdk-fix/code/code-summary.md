# Code Generation Summary: Unit `aws-sdk-fix`

## 1. Overview
The `aws-sdk-fix` unit overhauled, optimized, and standardized all AWS SDK operations across the Rust backend and TypeScript frontend for Dynamore.

---

## 2. Modified Files & Key Changes

### Backend (Rust / Tauri 2)
1. **[`src-tauri/src/aws_client.rs`](file:///development/foss/dynamore/src-tauri/src/aws_client.rs)**:
   - Introduced `AwsClientState` containing `Arc<RwLock<Option<CachedClient>>>` with session fingerprinting.
   - Implemented fast-path read locking and slow-path write locking to avoid rebuilding the AWS SDK client on every command invocation.
   - Added automatic session expiration checking for temporary credentials.
   - Sanitized empty and whitespace-only session tokens to prevent `InvalidClientTokenId` errors.
   - Added `sanitize_error_message` utility.

2. **[`src-tauri/src/main.rs`](file:///development/foss/dynamore/src-tauri/src/main.rs)**:
   - Registered `AwsClientState::new()` via Tauri's `.manage()` lifecycle hook.

3. **[`src-tauri/src/commands/tables.rs`](file:///development/foss/dynamore/src-tauri/src/commands/tables.rs)**:
   - Updated `tables_list`, `tables_describe`, `tables_create`, and `tables_delete` to use `State<'_, AwsClientState>` and return `Result<Value, String>` with proper `Err` propagation.
   - Enhanced `parse_create_table_input` to correctly omit `ProvisionedThroughput` when `BillingMode == "PAY_PER_REQUEST"` and validate throughput on `PROVISIONED` tables/GSIs.
   - Mapped full schema, billing mode, GSIs, and LSIs in `map_table_description`.

4. **[`src-tauri/src/commands/items.rs`](file:///development/foss/dynamore/src-tauri/src/commands/items.rs)**:
   - Upgraded `items_put`, `items_get`, `items_update`, `items_delete`, and `items_batch_delete` with `serde_dynamo` attribute serialization and clean error returns.
   - Implemented 25-item chunking with exponential backoff retry for `unprocessed_items` in `items_batch_delete`.

5. **[`src-tauri/src/commands/query.rs`](file:///development/foss/dynamore/src-tauri/src/commands/query.rs)**:
   - Replaced single-page scans/queries with an auto-pagination accumulation loop (up to target limit or 10 iterations) when `filter_expression` is present.
   - Correctly returns accumulated matching items, total scanned count, and pagination continuation keys.

6. **[`src-tauri/src/commands/auth.rs`](file:///development/foss/dynamore/src-tauri/src/commands/auth.rs)**:
   - Invalidated `AwsClientState` cache on login, complete SSO login, and logout.
   - Standardized `auth_login_with_keys` to return sanitized error messages and updated `auth_get_session` to detect expired SSO credentials.

### Frontend (React 18 / TypeScript)
7. **[`src/components/Sidebar.tsx`](file:///development/foss/dynamore/src/components/Sidebar.tsx)**:
   - Added robust `try / catch` handling across `loadTables`, `handleSelectTable`, and `handleDeleteTable`.

8. **[`src/components/QueryBuilder.tsx`](file:///development/foss/dynamore/src/components/QueryBuilder.tsx)**:
   - Wrapped query invocation in `try / catch / finally` and integrated accumulated item counts.

9. **[`src/components/ScanBuilder.tsx`](file:///development/foss/dynamore/src/components/ScanBuilder.tsx)**:
   - Wrapped scan invocation in `try / catch / finally`.

10. **[`src/components/ItemEditor.tsx`](file:///development/foss/dynamore/src/components/ItemEditor.tsx)**:
    - Wrapped item creation/update in `try / catch / finally`.

11. **[`src/components/ResultsGrid.tsx`](file:///development/foss/dynamore/src/components/ResultsGrid.tsx)**:
    - Wrapped single item deletion and batch deletion in `try / catch`.

12. **[`src/pages/CreateTableWizard.tsx`](file:///development/foss/dynamore/src/pages/CreateTableWizard.tsx)**:
    - Wrapped table creation in `try / catch / finally`.

---

## 3. Verification
- **Rust Backend**: `cargo check` compiled with zero errors.
- **Frontend**: `npm run build` (`tsc && vite build`) bundled cleanly with zero type or build errors.
