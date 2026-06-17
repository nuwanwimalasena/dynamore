use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryParams {
    pub table_name: String,
    pub index_name: Option<String>,
    pub key_condition_expression: String,
    pub filter_expression: Option<String>,
    pub projection_expression: Option<String>,
    pub expression_attribute_names: Option<HashMap<String, String>>,
    pub expression_attribute_values: Option<HashMap<String, serde_json::Value>>,
    pub limit: Option<i32>,
    pub exclusive_start_key: Option<HashMap<String, serde_json::Value>>,
    pub scan_index_forward: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanParams {
    pub table_name: String,
    pub index_name: Option<String>,
    pub filter_expression: Option<String>,
    pub projection_expression: Option<String>,
    pub expression_attribute_names: Option<HashMap<String, String>>,
    pub expression_attribute_values: Option<HashMap<String, serde_json::Value>>,
    pub limit: Option<i32>,
    pub exclusive_start_key: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<HashMap<String, serde_json::Value>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scanned_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_evaluated_key: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[tauri::command]
pub async fn query_query(
    app: tauri::AppHandle,
    params: QueryParams,
) -> Result<QueryResult, String> {
    let client = crate::aws_client::get_dynamodb_client(app.clone()).await?;
    
    let mut builder = client.query()
        .table_name(params.table_name)
        .key_condition_expression(params.key_condition_expression);
        
    if let Some(index) = params.index_name {
        builder = builder.index_name(index);
    }
    if let Some(filter) = params.filter_expression {
        builder = builder.filter_expression(filter);
    }
    if let Some(proj) = params.projection_expression {
        builder = builder.projection_expression(proj);
    }
    if let Some(names) = params.expression_attribute_names {
        for (k, v) in names {
            builder = builder.expression_attribute_names(k, v);
        }
    }
    if let Some(values) = params.expression_attribute_values {
        let attr_values = serde_dynamo::to_item(values).map_err(|e| e.to_string())?;
        builder = builder.set_expression_attribute_values(Some(attr_values));
    }
    if let Some(limit) = params.limit {
        builder = builder.limit(limit);
    }
    if let Some(start_key) = params.exclusive_start_key {
        let key_item = serde_dynamo::to_item(start_key).map_err(|e| e.to_string())?;
        builder = builder.set_exclusive_start_key(Some(key_item));
    }
    if let Some(forward) = params.scan_index_forward {
        builder = builder.scan_index_forward(forward);
    }

    match builder.send().await {
        Ok(res) => {
            let items = if let Some(dynamo_items) = res.items {
                let parsed: Vec<HashMap<String, serde_json::Value>> = serde_dynamo::from_items(dynamo_items).map_err(|e| e.to_string())?;
                Some(parsed)
            } else {
                Some(Vec::new())
            };

            let last_evaluated_key = if let Some(key) = res.last_evaluated_key {
                let parsed: HashMap<String, serde_json::Value> = serde_dynamo::from_item(key).map_err(|e| e.to_string())?;
                Some(parsed)
            } else {
                None
            };

            Ok(QueryResult {
                success: true,
                items,
                count: Some(res.count),
                scanned_count: Some(res.scanned_count),
                last_evaluated_key,
                error: None,
            })
        }
        Err(e) => {
            Ok(QueryResult {
                success: false,
                items: None,
                count: None,
                scanned_count: None,
                last_evaluated_key: None,
                error: Some(e.to_string()),
            })
        }
    }
}

#[tauri::command]
pub async fn query_scan(
    app: tauri::AppHandle,
    params: ScanParams,
) -> Result<QueryResult, String> {
    let client = crate::aws_client::get_dynamodb_client(app.clone()).await?;
    
    let mut builder = client.scan()
        .table_name(params.table_name);
        
    if let Some(index) = params.index_name {
        builder = builder.index_name(index);
    }
    if let Some(filter) = params.filter_expression {
        builder = builder.filter_expression(filter);
    }
    if let Some(proj) = params.projection_expression {
        builder = builder.projection_expression(proj);
    }
    if let Some(names) = params.expression_attribute_names {
        for (k, v) in names {
            builder = builder.expression_attribute_names(k, v);
        }
    }
    if let Some(values) = params.expression_attribute_values {
        let attr_values = serde_dynamo::to_item(values).map_err(|e| e.to_string())?;
        builder = builder.set_expression_attribute_values(Some(attr_values));
    }
    if let Some(limit) = params.limit {
        builder = builder.limit(limit);
    }
    if let Some(start_key) = params.exclusive_start_key {
        let key_item = serde_dynamo::to_item(start_key).map_err(|e| e.to_string())?;
        builder = builder.set_exclusive_start_key(Some(key_item));
    }

    match builder.send().await {
        Ok(res) => {
            let items = if let Some(dynamo_items) = res.items {
                let parsed: Vec<HashMap<String, serde_json::Value>> = serde_dynamo::from_items(dynamo_items).map_err(|e| e.to_string())?;
                Some(parsed)
            } else {
                Some(Vec::new())
            };

            let last_evaluated_key = if let Some(key) = res.last_evaluated_key {
                let parsed: HashMap<String, serde_json::Value> = serde_dynamo::from_item(key).map_err(|e| e.to_string())?;
                Some(parsed)
            } else {
                None
            };

            Ok(QueryResult {
                success: true,
                items,
                count: Some(res.count),
                scanned_count: Some(res.scanned_count),
                last_evaluated_key,
                error: None,
            })
        }
        Err(e) => {
            Ok(QueryResult {
                success: false,
                items: None,
                count: None,
                scanned_count: None,
                last_evaluated_key: None,
                error: Some(e.to_string()),
            })
        }
    }
}
