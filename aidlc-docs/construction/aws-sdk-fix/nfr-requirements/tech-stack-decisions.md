# Tech Stack Decisions: Unit `aws-sdk-fix`

## 1. Concurrency & State Management
- **Decision**: Use `tokio::sync::RwLock` for `AwsClientState` in `src-tauri/src/aws_client.rs`.
- **Rationale**: Read operations (query, scan, describe, get, put, update) happen concurrently across multiple UI components and tabs; `RwLock` allows concurrent read access while safely serializing writes during session invalidation or region changes.

## 2. Serialization & DynamoDB Type Mapping
- **Decision**: Standardize on `serde_dynamo = "4"` with feature `aws-sdk-dynamodb+1`.
- **Rationale**: Provides native, optimized conversion between `serde_json::Value` and `aws_sdk_dynamodb::types::AttributeValue`, reducing manual builder code and potential type mismatch regressions.

## 3. Desktop Framework & IPC
- **Decision**: Tauri 2 (`tauri = "2.11.2"`) managed state via `app.manage(AwsClientState::new())` in `main.rs`.
- **Rationale**: Tauri 2's managed state pattern provides thread-safe dependency injection across all `#[tauri::command]` handlers.
