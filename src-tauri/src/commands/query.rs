use crate::aws_client::{get_dynamodb_client, AwsClientState};
use crate::error::AppError;
use crate::models::query::*;
use crate::services::DynamoService;
use tauri::{command, AppHandle, State};

#[command]
pub async fn query_query(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    req: QueryRequest,
) -> Result<QueryResultDto, AppError> {
    let client = get_dynamodb_client(&state, &app).await?;
    DynamoService::execute_query(&client, req).await
}

#[command]
pub async fn query_scan(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    req: ScanRequest,
) -> Result<QueryResultDto, AppError> {
    let client = get_dynamodb_client(&state, &app).await?;
    DynamoService::execute_scan(&client, req).await
}
