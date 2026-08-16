# Logical Components: Unit `aws-sdk-fix`

## 1. `AwsClientState` (State Management & Caching)
- **Module**: `src-tauri/src/aws_client.rs`
- **Role**: Maintains the active `DynamoDbClient` instance inside Tauri's managed state runtime.
- **Interfaces**:
  - `AwsClientState::new()`: Initializes empty cache with `RwLock`.
  - `get_dynamodb_client(state: tauri::State<AwsClientState>, app: AppHandle) -> Result<DynamoDbClient, String>`: Returns pre-authenticated client.
  - `invalidate_client(state: tauri::State<AwsClientState>)`: Clears cached client on logout / session switch.

## 2. `ErrorSanitizer` (Security & IPC Formatting)
- **Module**: `src-tauri/src/commands/mod.rs` (or inline utility)
- **Role**: Maps AWS SDK SdkError / ServiceError into clean, non-leaking user strings.
- **Interfaces**:
  - `format_sdk_error<T, R>(err: aws_sdk_dynamodb::error::SdkError<T, R>) -> String`

## 3. `PaginationAccumulator` (Resilient Query/Scan Evaluator)
- **Module**: `src-tauri/src/commands/query.rs`
- **Role**: Evaluates multi-page scan/query iterations in a bounded loop until limit or EOF is reached.
- **Interfaces**:
  - `execute_accumulated_query(client, params, limit, max_pages) -> Result<QueryResultPayload, String>`
  - `execute_accumulated_scan(client, params, limit, max_pages) -> Result<QueryResultPayload, String>`

## 4. `BatchWriteExecutor` (Resilient Batch Deletion)
- **Module**: `src-tauri/src/commands/items.rs`
- **Role**: Splits items into 25-item chunks, invokes `batch_write_item`, and retries any `unprocessed_items`.
