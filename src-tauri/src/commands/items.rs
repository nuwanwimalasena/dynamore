use crate::aws_client::{get_dynamodb_client, AwsClientState};
use crate::error::AppError;
use crate::models::items::*;
use crate::services::DynamoService;
use tauri::{command, AppHandle, State};

#[command]
pub async fn items_put(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    table_name: String,
    item: std::collections::HashMap<String, serde_json::Value>,
) -> Result<MutationResponse, AppError> {
    let client = get_dynamodb_client(&state, &app).await?;
    DynamoService::put_item(&client, PutItemRequest { table_name, item }).await
}

#[command]
pub async fn items_get(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    table_name: String,
    key: std::collections::HashMap<String, serde_json::Value>,
) -> Result<ItemResponse, AppError> {
    let client = get_dynamodb_client(&state, &app).await?;
    DynamoService::get_item(&client, GetItemRequest { table_name, key }).await
}

#[command]
pub async fn items_update(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    req: UpdateItemRequest,
) -> Result<ItemResponse, AppError> {
    let client = get_dynamodb_client(&state, &app).await?;
    DynamoService::update_item(&client, req).await
}

#[command]
pub async fn items_delete(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    table_name: String,
    key: std::collections::HashMap<String, serde_json::Value>,
) -> Result<MutationResponse, AppError> {
    let client = get_dynamodb_client(&state, &app).await?;
    DynamoService::delete_item(&client, DeleteItemRequest { table_name, key }).await
}

#[command]
pub async fn items_batch_delete(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    table_name: String,
    keys: Vec<std::collections::HashMap<String, serde_json::Value>>,
) -> Result<MutationResponse, AppError> {
    let client = get_dynamodb_client(&state, &app).await?;
    DynamoService::batch_delete_items(&client, BatchDeleteItemsRequest { table_name, keys }).await
}
