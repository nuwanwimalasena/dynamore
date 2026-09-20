use aws_sdk_dynamodb::types::AttributeValue;
use app_lib::models::query::*;
use std::collections::HashMap;

#[test]
fn test_query_request_limit_clamping_logic() {
    let req_none = QueryRequest {
        table_name: "Users".to_string(),
        key_condition_expression: "id = :id".to_string(),
        index_name: None,
        filter_expression: None,
        projection_expression: None,
        expression_attribute_names: None,
        expression_attribute_values: None,
        limit: None,
        exclusive_start_key: None,
        scan_index_forward: None,
    };
    let limit_none = req_none.limit.unwrap_or(50).clamp(1, 1000);
    assert_eq!(limit_none, 50);

    let req_zero = QueryRequest {
        limit: Some(0),
        ..req_none.clone()
    };
    let limit_zero = req_zero.limit.unwrap_or(50).clamp(1, 1000);
    assert_eq!(limit_zero, 1);

    let req_huge = QueryRequest {
        limit: Some(5000),
        ..req_none.clone()
    };
    let limit_huge = req_huge.limit.unwrap_or(50).clamp(1, 1000);
    assert_eq!(limit_huge, 1000);

    let req_custom = QueryRequest {
        limit: Some(75),
        ..req_none
    };
    let limit_custom = req_custom.limit.unwrap_or(50).clamp(1, 1000);
    assert_eq!(limit_custom, 75);
}

#[test]
fn test_query_pagination_accumulation_math() {
    let target_limit = 50usize;
    let mut accumulated: Vec<i32> = Vec::new();

    // Iteration 1: receives 20 items
    let remaining_1 = target_limit.saturating_sub(accumulated.len());
    assert_eq!(remaining_1, 50);
    accumulated.extend(0..20);

    // Iteration 2: receives 25 items
    let remaining_2 = target_limit.saturating_sub(accumulated.len());
    assert_eq!(remaining_2, 30);
    accumulated.extend(20..45);

    // Iteration 3: receives 10 items (total 55)
    let remaining_3 = target_limit.saturating_sub(accumulated.len());
    assert_eq!(remaining_3, 5);
    accumulated.extend(45..55);

    // Truncation check
    if accumulated.len() > target_limit {
        accumulated.truncate(target_limit);
    }
    assert_eq!(accumulated.len(), 50);
}

#[test]
fn test_exclusive_start_key_serialization() {
    let mut start_key = HashMap::new();
    start_key.insert("pk".to_string(), serde_json::json!("user_100"));
    start_key.insert("sk".to_string(), serde_json::json!(1620000000));

    let av_key_res: Result<HashMap<String, AttributeValue>, _> = serde_dynamo::to_item(start_key.clone());
    assert!(av_key_res.is_ok());
    let av_key = av_key_res.unwrap();

    assert!(matches!(av_key.get("pk"), Some(AttributeValue::S(s)) if s == "user_100"));
    assert!(matches!(av_key.get("sk"), Some(AttributeValue::N(n)) if n == "1620000000"));

    let restored: Result<HashMap<String, serde_json::Value>, _> = serde_dynamo::from_item(av_key);
    assert!(restored.is_ok());
    assert_eq!(restored.unwrap(), start_key);
}

#[test]
fn test_query_result_dto_serialization() {
    let result = QueryResultDto {
        items: vec![
            {
                let mut m = HashMap::new();
                m.insert("id".to_string(), serde_json::json!("1"));
                m
            },
            {
                let mut m = HashMap::new();
                m.insert("id".to_string(), serde_json::json!("2"));
                m
            },
        ],
        count: 2,
        scanned_count: 10,
        last_evaluated_key: Some({
            let mut m = HashMap::new();
            m.insert("id".to_string(), serde_json::json!("2"));
            m
        }),
    };

    let serialized = serde_json::to_value(&result).unwrap();
    assert_eq!(serialized["count"], 2);
    assert_eq!(serialized["scannedCount"], 10);
    assert_eq!(serialized["items"].as_array().unwrap().len(), 2);
    assert_eq!(serialized["lastEvaluatedKey"]["id"], "2");
}
