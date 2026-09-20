use crate::aws_client::{get_dynamodb_client, AwsClientState};
use crate::error::AppError;
use crate::models::tables::*;
use crate::services::DynamoService;
use tauri::{command, AppHandle, State};

#[command]
pub async fn tables_list(
    state: State<'_, AwsClientState>,
    app: AppHandle,
) -> Result<TableListResponse, AppError> {
    let client = get_dynamodb_client(&state, &app).await?;
    DynamoService::list_tables(&client).await
}

#[command]
pub async fn tables_describe(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    table_name: String,
) -> Result<TableDescribeResponse, AppError> {
    let client = get_dynamodb_client(&state, &app).await?;
    DynamoService::describe_table(&client, &table_name).await
}

#[command]
pub async fn tables_create(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    req: CreateTableRequest,
) -> Result<TableCreateResponse, AppError> {
    let client = get_dynamodb_client(&state, &app).await?;
    DynamoService::create_table(&client, req).await
}

#[command]
pub async fn tables_delete(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    table_name: String,
) -> Result<TableDeleteResponse, AppError> {
    let client = get_dynamodb_client(&state, &app).await?;
    DynamoService::delete_table(&client, &table_name).await
}
