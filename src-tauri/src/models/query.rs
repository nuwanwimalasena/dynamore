use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryRequest {
    pub table_name: String,
    pub key_condition_expression: String,
    pub index_name: Option<String>,
    pub filter_expression: Option<String>,
    pub projection_expression: Option<String>,
    pub expression_attribute_names: Option<HashMap<String, String>>,
    pub expression_attribute_values: Option<HashMap<String, serde_json::Value>>,
    pub limit: Option<usize>,
    pub exclusive_start_key: Option<HashMap<String, serde_json::Value>>,
    pub scan_index_forward: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRequest {
    pub table_name: String,
    pub index_name: Option<String>,
    pub filter_expression: Option<String>,
    pub projection_expression: Option<String>,
    pub expression_attribute_names: Option<HashMap<String, String>>,
    pub expression_attribute_values: Option<HashMap<String, serde_json::Value>>,
    pub limit: Option<usize>,
    pub exclusive_start_key: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResultDto {
    pub items: Vec<HashMap<String, serde_json::Value>>,
    pub count: i32,
    pub scanned_count: i32,
    pub last_evaluated_key: Option<HashMap<String, serde_json::Value>>,
}
