use crate::aws_client::{get_dynamodb_client, sanitize_error_message, AwsClientState};
use aws_sdk_dynamodb::types::AttributeValue;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{command, AppHandle, State};

#[derive(Deserialize, Debug, Clone)]
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

#[derive(Deserialize, Debug, Clone)]
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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub success: bool,
    pub items: Option<Vec<HashMap<String, serde_json::Value>>>,
    pub count: Option<i32>,
    pub scanned_count: Option<i32>,
    pub last_evaluated_key: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[command]
pub async fn query_query(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    params: QueryParams,
) -> Result<QueryResult, String> {
    let client = get_dynamodb_client(&state, &app).await?;

    let target_limit = params.limit.unwrap_or(50).clamp(1, 1000) as usize;
    let has_filter = params.filter_expression.is_some();
    let max_iterations = if has_filter { 10 } else { 1 };

    let mut accumulated_items: Vec<HashMap<String, serde_json::Value>> = Vec::new();
    let mut total_scanned = 0;
    let mut current_start_key = if let Some(sk) = params.exclusive_start_key {
        let key_item: HashMap<String, AttributeValue> = serde_dynamo::to_item(sk)
            .map_err(|e| format!("Invalid exclusiveStartKey: {}", e))?;
        Some(key_item)
    } else {
        None
    };

    let mut final_last_evaluated_key = None;

    for _iteration in 0..max_iterations {
        let remaining_needed = target_limit.saturating_sub(accumulated_items.len());
        if remaining_needed == 0 {
            break;
        }

        let mut builder = client
            .query()
            .table_name(&params.table_name)
            .key_condition_expression(&params.key_condition_expression);

        if let Some(ref index) = params.index_name {
            builder = builder.index_name(index);
        }
        if let Some(ref filter) = params.filter_expression {
            builder = builder.filter_expression(filter);
        }
        if let Some(ref proj) = params.projection_expression {
            builder = builder.projection_expression(proj);
        }
        if let Some(ref names) = params.expression_attribute_names {
            for (k, v) in names {
                builder = builder.expression_attribute_names(k, v);
            }
        }
        if let Some(ref values) = params.expression_attribute_values {
            let attr_values: HashMap<String, AttributeValue> = serde_dynamo::to_item(values.clone())
                .map_err(|e| format!("Invalid expressionAttributeValues: {}", e))?;
            builder = builder.set_expression_attribute_values(Some(attr_values));
        }

        let page_limit = if has_filter {
            // When filtering, request a reasonable batch to make progress
            std::cmp::max(remaining_needed as i32, 100)
        } else {
            remaining_needed as i32
        };

        builder = builder.limit(page_limit);

        if let Some(ref sk) = current_start_key {
            builder = builder.set_exclusive_start_key(Some(sk.clone()));
        }

        if let Some(forward) = params.scan_index_forward {
            builder = builder.scan_index_forward(forward);
        }

        let res = builder.send().await.map_err(sanitize_error_message)?;

        total_scanned += res.scanned_count;

        if let Some(dynamo_items) = res.items {
            let parsed_items: Vec<HashMap<String, serde_json::Value>> =
                serde_dynamo::from_items(dynamo_items)
                    .map_err(|e| format!("Failed to parse query result items: {}", e))?;
            accumulated_items.extend(parsed_items);
        }

        current_start_key = res.last_evaluated_key;
        final_last_evaluated_key = current_start_key.clone();

        if current_start_key.is_none() || accumulated_items.len() >= target_limit {
            break;
        }
    }

    // Truncate to exact target limit if slightly exceeded during accumulation
    if accumulated_items.len() > target_limit {
        accumulated_items.truncate(target_limit);
    }

    let parsed_last_key = if let Some(key) = final_last_evaluated_key {
        let parsed: HashMap<String, serde_json::Value> = serde_dynamo::from_item(key)
            .map_err(|e| format!("Failed to parse lastEvaluatedKey: {}", e))?;
        Some(parsed)
    } else {
        None
    };

    let count = accumulated_items.len() as i32;

    Ok(QueryResult {
        success: true,
        items: Some(accumulated_items),
        count: Some(count),
        scanned_count: Some(total_scanned),
        last_evaluated_key: parsed_last_key,
        error: None,
    })
}

#[command]
pub async fn query_scan(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    params: ScanParams,
) -> Result<QueryResult, String> {
    let client = get_dynamodb_client(&state, &app).await?;

    let target_limit = params.limit.unwrap_or(50).clamp(1, 1000) as usize;
    let has_filter = params.filter_expression.is_some();
    let max_iterations = if has_filter { 10 } else { 1 };

    let mut accumulated_items: Vec<HashMap<String, serde_json::Value>> = Vec::new();
    let mut total_scanned = 0;
    let mut current_start_key = if let Some(sk) = params.exclusive_start_key {
        let key_item: HashMap<String, AttributeValue> = serde_dynamo::to_item(sk)
            .map_err(|e| format!("Invalid exclusiveStartKey: {}", e))?;
        Some(key_item)
    } else {
        None
    };

    let mut final_last_evaluated_key = None;

    for _iteration in 0..max_iterations {
        let remaining_needed = target_limit.saturating_sub(accumulated_items.len());
        if remaining_needed == 0 {
            break;
        }

        let mut builder = client.scan().table_name(&params.table_name);

        if let Some(ref index) = params.index_name {
            builder = builder.index_name(index);
        }
        if let Some(ref filter) = params.filter_expression {
            builder = builder.filter_expression(filter);
        }
        if let Some(ref proj) = params.projection_expression {
            builder = builder.projection_expression(proj);
        }
        if let Some(ref names) = params.expression_attribute_names {
            for (k, v) in names {
                builder = builder.expression_attribute_names(k, v);
            }
        }
        if let Some(ref values) = params.expression_attribute_values {
            let attr_values: HashMap<String, AttributeValue> = serde_dynamo::to_item(values.clone())
                .map_err(|e| format!("Invalid expressionAttributeValues: {}", e))?;
            builder = builder.set_expression_attribute_values(Some(attr_values));
        }

        let page_limit = if has_filter {
            std::cmp::max(remaining_needed as i32, 100)
        } else {
            remaining_needed as i32
        };

        builder = builder.limit(page_limit);

        if let Some(ref sk) = current_start_key {
            builder = builder.set_exclusive_start_key(Some(sk.clone()));
        }

        let res = builder.send().await.map_err(sanitize_error_message)?;

        total_scanned += res.scanned_count;

        if let Some(dynamo_items) = res.items {
            let parsed_items: Vec<HashMap<String, serde_json::Value>> =
                serde_dynamo::from_items(dynamo_items)
                    .map_err(|e| format!("Failed to parse scan result items: {}", e))?;
            accumulated_items.extend(parsed_items);
        }

        current_start_key = res.last_evaluated_key;
        final_last_evaluated_key = current_start_key.clone();

        if current_start_key.is_none() || accumulated_items.len() >= target_limit {
            break;
        }
    }

    if accumulated_items.len() > target_limit {
        accumulated_items.truncate(target_limit);
    }

    let parsed_last_key = if let Some(key) = final_last_evaluated_key {
        let parsed: HashMap<String, serde_json::Value> = serde_dynamo::from_item(key)
            .map_err(|e| format!("Failed to parse lastEvaluatedKey: {}", e))?;
        Some(parsed)
    } else {
        None
    };

    let count = accumulated_items.len() as i32;

    Ok(QueryResult {
        success: true,
        items: Some(accumulated_items),
        count: Some(count),
        scanned_count: Some(total_scanned),
        last_evaluated_key: parsed_last_key,
        error: None,
    })
}
