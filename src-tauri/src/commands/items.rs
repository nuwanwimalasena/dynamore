use crate::aws_client::{get_dynamodb_client, sanitize_error_message, AwsClientState};
use aws_sdk_dynamodb::types::{AttributeValue, DeleteRequest, WriteRequest};
use serde_json::Value;
use std::collections::HashMap;
use tauri::{command, AppHandle, State};

#[command]
pub async fn items_put(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    table_name: String,
    item: Value,
) -> Result<Value, String> {
    let client = get_dynamodb_client(&state, &app).await?;
    let item_map: HashMap<String, AttributeValue> =
        serde_dynamo::to_item(item).map_err(|e| format!("Failed to serialize item: {}", e))?;

    client
        .put_item()
        .table_name(table_name)
        .set_item(Some(item_map))
        .send()
        .await
        .map_err(sanitize_error_message)?;

    Ok(serde_json::json!({ "success": true }))
}

#[command]
pub async fn items_get(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    table_name: String,
    key: Value,
) -> Result<Value, String> {
    let client = get_dynamodb_client(&state, &app).await?;
    let key_map: HashMap<String, AttributeValue> =
        serde_dynamo::to_item(key).map_err(|e| format!("Failed to serialize key: {}", e))?;

    let res = client
        .get_item()
        .table_name(table_name)
        .set_key(Some(key_map))
        .send()
        .await
        .map_err(sanitize_error_message)?;

    if let Some(item) = res.item {
        let parsed_map: HashMap<String, Value> = serde_dynamo::from_item(item)
            .map_err(|e| format!("Failed to deserialize item: {}", e))?;
        let json_item = serde_json::to_value(parsed_map).unwrap_or(Value::Null);
        Ok(serde_json::json!({ "success": true, "item": json_item }))
    } else {
        Ok(serde_json::json!({ "success": true, "item": Value::Null }))
    }
}

#[command]
pub async fn items_update(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    params: Value,
) -> Result<Value, String> {
    let client = get_dynamodb_client(&state, &app).await?;

    let table_name = params
        .get("TableName")
        .or_else(|| params.get("tableName"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| "TableName is required".to_string())?
        .to_string();

    let key = params
        .get("Key")
        .or_else(|| params.get("key"))
        .cloned()
        .ok_or_else(|| "Key is required".to_string())?;

    let key_map: HashMap<String, AttributeValue> =
        serde_dynamo::to_item(key).map_err(|e| format!("Failed to serialize key: {}", e))?;

    let mut req = client
        .update_item()
        .table_name(table_name)
        .set_key(Some(key_map));

    if let Some(expr) = params
        .get("UpdateExpression")
        .or_else(|| params.get("updateExpression"))
        .and_then(|v| v.as_str())
    {
        req = req.update_expression(expr);
    }

    if let Some(names) = params
        .get("ExpressionAttributeNames")
        .or_else(|| params.get("expressionAttributeNames"))
        .and_then(|v| v.as_object())
    {
        for (k, v) in names {
            if let Some(name_val) = v.as_str() {
                req = req.expression_attribute_names(k, name_val);
            }
        }
    }

    if let Some(values) = params
        .get("ExpressionAttributeValues")
        .or_else(|| params.get("expressionAttributeValues"))
        .cloned()
    {
        let val_map: HashMap<String, AttributeValue> = serde_dynamo::to_item(values)
            .map_err(|e| format!("Failed to serialize ExpressionAttributeValues: {}", e))?;
        req = req.set_expression_attribute_values(Some(val_map));
    }

    let res = req.send().await.map_err(sanitize_error_message)?;

    if let Some(attrs) = res.attributes {
        let parsed_attrs: HashMap<String, Value> = serde_dynamo::from_item(attrs)
            .map_err(|e| format!("Failed to deserialize updated attributes: {}", e))?;
        let json_attrs = serde_json::to_value(parsed_attrs).unwrap_or(Value::Null);
        Ok(serde_json::json!({ "success": true, "attributes": json_attrs }))
    } else {
        Ok(serde_json::json!({ "success": true }))
    }
}

#[command]
pub async fn items_delete(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    table_name: String,
    key: Value,
) -> Result<Value, String> {
    let client = get_dynamodb_client(&state, &app).await?;
    let key_map: HashMap<String, AttributeValue> =
        serde_dynamo::to_item(key).map_err(|e| format!("Failed to serialize key: {}", e))?;

    client
        .delete_item()
        .table_name(table_name)
        .set_key(Some(key_map))
        .send()
        .await
        .map_err(sanitize_error_message)?;

    Ok(serde_json::json!({ "success": true }))
}

#[command]
pub async fn items_batch_delete(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    table_name: String,
    keys: Vec<Value>,
) -> Result<Value, String> {
    let client = get_dynamodb_client(&state, &app).await?;

    for chunk in keys.chunks(25) {
        let mut write_requests = Vec::new();
        for key in chunk {
            let key_map: HashMap<String, AttributeValue> = serde_dynamo::to_item(key.clone())
                .map_err(|e| format!("Failed to serialize batch key: {}", e))?;

            let del_req = DeleteRequest::builder()
                .set_key(Some(key_map))
                .build()
                .map_err(|e| format!("Failed to build DeleteRequest: {}", e))?;

            let req = WriteRequest::builder().delete_request(del_req).build();
            write_requests.push(req);
        }

        let mut pending_requests = write_requests;
        let mut retry_count = 0;
        let max_retries = 3;

        while !pending_requests.is_empty() {
            let output = client
                .batch_write_item()
                .request_items(table_name.clone(), pending_requests)
                .send()
                .await
                .map_err(sanitize_error_message)?;

            if let Some(unprocessed) = output.unprocessed_items {
                if let Some(unprocessed_for_table) = unprocessed.get(&table_name) {
                    if !unprocessed_for_table.is_empty() {
                        retry_count += 1;
                        if retry_count > max_retries {
                            return Err(format!(
                                "Batch write partially failed: {} unprocessed items after {} retries",
                                unprocessed_for_table.len(),
                                max_retries
                            ));
                        }
                        tokio::time::sleep(tokio::time::Duration::from_millis(
                            100 * (1 << retry_count),
                        ))
                        .await;
                        pending_requests = unprocessed_for_table.clone();
                        continue;
                    }
                }
            }
            break;
        }
    }

    Ok(serde_json::json!({ "success": true, "deletedCount": keys.len() }))
}
