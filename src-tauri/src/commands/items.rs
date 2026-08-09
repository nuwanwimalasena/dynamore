use crate::aws_client::get_dynamodb_client;
use aws_sdk_dynamodb::types::{AttributeValue, PutRequest, WriteRequest};
use serde_json::Value;
use std::collections::HashMap;
use tauri::{command, AppHandle};

#[command]
pub async fn items_put(app: AppHandle, table_name: String, item: Value) -> Result<Value, String> {
    let client = get_dynamodb_client(app).await?;
    let item_map: HashMap<String, AttributeValue> = serde_dynamo::to_item(item)
        .map_err(|e| e.to_string())?;

    client
        .put_item()
        .table_name(table_name)
        .set_item(Some(item_map))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "success": true }))
}

#[command]
pub async fn items_get(app: AppHandle, table_name: String, key: Value) -> Result<Value, String> {
    let client = get_dynamodb_client(app).await?;
    let key_map: HashMap<String, AttributeValue> = serde_dynamo::to_item(key)
        .map_err(|e| e.to_string())?;

    let res = client
        .get_item()
        .table_name(table_name)
        .set_key(Some(key_map))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(item) = res.item {
        let json_item: Value = serde_json::to_value(serde_dynamo::from_item::<_, HashMap<String, Value>>(item).map_err(|e| e.to_string())?).unwrap_or(Value::Null);
        Ok(serde_json::json!({ "success": true, "item": json_item }))
    } else {
        Ok(serde_json::json!({ "success": true, "item": Value::Null }))
    }
}

#[command]
pub async fn items_update(app: AppHandle, params: Value) -> Result<Value, String> {
    let client = get_dynamodb_client(app).await?;
    
    let table_name = params.get("TableName").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let key = params.get("Key").cloned().unwrap_or(Value::Null);
    let key_map: HashMap<String, AttributeValue> = serde_dynamo::to_item(key).map_err(|e| e.to_string())?;
    
    let mut req = client.update_item().table_name(table_name).set_key(Some(key_map));

    if let Some(expr) = params.get("UpdateExpression").and_then(|v| v.as_str()) {
        req = req.update_expression(expr);
    }
    
    if let Some(names) = params.get("ExpressionAttributeNames") {
        if let Some(obj) = names.as_object() {
            for (k, v) in obj {
                req = req.expression_attribute_names(k, v.as_str().unwrap_or(""));
            }
        }
    }

    if let Some(values) = params.get("ExpressionAttributeValues") {
        let val_map: HashMap<String, AttributeValue> = serde_dynamo::to_item(values.clone()).map_err(|e| e.to_string())?;
        req = req.set_expression_attribute_values(Some(val_map));
    }

    let res = req.send().await.map_err(|e| e.to_string())?;
    
    if let Some(attrs) = res.attributes {
        let json_attrs: Value = serde_json::to_value(serde_dynamo::from_item::<_, HashMap<String, Value>>(attrs).map_err(|e| e.to_string())?).unwrap_or(Value::Null);
        Ok(serde_json::json!({ "success": true, "attributes": json_attrs }))
    } else {
        Ok(serde_json::json!({ "success": true }))
    }
}

#[command]
pub async fn items_delete(app: AppHandle, table_name: String, key: Value) -> Result<Value, String> {
    let client = get_dynamodb_client(app).await?;
    let key_map: HashMap<String, AttributeValue> = serde_dynamo::to_item(key)
        .map_err(|e| e.to_string())?;

    client
        .delete_item()
        .table_name(table_name)
        .set_key(Some(key_map))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "success": true }))
}

#[command]
pub async fn items_batch_delete(app: AppHandle, table_name: String, keys: Vec<Value>) -> Result<Value, String> {
    let client = get_dynamodb_client(app).await?;
    
    for chunk in keys.chunks(25) {
        let mut write_requests = Vec::new();
        for key in chunk {
            let key_map: HashMap<String, AttributeValue> = serde_dynamo::to_item(key.clone())
                .map_err(|e| e.to_string())?;
            
            let req = WriteRequest::builder()
                .delete_request(
                    aws_sdk_dynamodb::types::DeleteRequest::builder().set_key(Some(key_map)).build().map_err(|e| e.to_string())?
                )
                .build();
            write_requests.push(req);
        }
        
        client.batch_write_item()
            .request_items(table_name.clone(), write_requests)
            .send()
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(serde_json::json!({ "success": true, "deletedCount": keys.len() }))
}
