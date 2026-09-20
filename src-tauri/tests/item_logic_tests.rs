use aws_sdk_dynamodb::types::AttributeValue;
use std::collections::HashMap;

#[test]
fn test_complex_nested_item_marshaling() {
    let mut raw = HashMap::new();
    raw.insert("id".to_string(), serde_json::json!("order_999"));
    raw.insert("amount".to_string(), serde_json::json!(199.95));
    raw.insert("tax".to_string(), serde_json::json!(15));
    raw.insert("isPaid".to_string(), serde_json::json!(true));
    raw.insert("discountCode".to_string(), serde_json::Value::Null);
    raw.insert(
        "tags".to_string(),
        serde_json::json!(["priority", "international", "gift"]),
    );
    raw.insert(
        "customer".to_string(),
        serde_json::json!({
            "name": "Jane Doe",
            "email": "jane@example.com",
            "tier": 2,
            "address": {
                "city": "Seattle",
                "zip": "98101"
            }
        }),
    );

    // 1. Serialize to DynamoDB AttributeValues
    let to_dynamo_res: Result<HashMap<String, AttributeValue>, _> = serde_dynamo::to_item(raw.clone());
    assert!(to_dynamo_res.is_ok(), "Failed to serialize JSON to DynamoDB attributes");

    let ddb_map = to_dynamo_res.unwrap();
    assert!(matches!(ddb_map.get("id"), Some(AttributeValue::S(s)) if s == "order_999"));
    assert!(matches!(ddb_map.get("amount"), Some(AttributeValue::N(n)) if n == "199.95"));
    assert!(matches!(ddb_map.get("tax"), Some(AttributeValue::N(n)) if n == "15"));
    assert!(matches!(ddb_map.get("isPaid"), Some(AttributeValue::Bool(true))));
    assert!(matches!(ddb_map.get("discountCode"), Some(AttributeValue::Null(true))));

    // Validate nested list
    if let Some(AttributeValue::L(list)) = ddb_map.get("tags") {
        assert_eq!(list.len(), 3);
        assert!(matches!(&list[0], AttributeValue::S(s) if s == "priority"));
    } else {
        panic!("Expected AttributeValue::L for 'tags'");
    }

    // Validate nested map
    if let Some(AttributeValue::M(map)) = ddb_map.get("customer") {
        assert!(matches!(map.get("name"), Some(AttributeValue::S(s)) if s == "Jane Doe"));
        assert!(matches!(map.get("tier"), Some(AttributeValue::N(n)) if n == "2"));
        if let Some(AttributeValue::M(addr)) = map.get("address") {
            assert!(matches!(addr.get("city"), Some(AttributeValue::S(s)) if s == "Seattle"));
            assert!(matches!(addr.get("zip"), Some(AttributeValue::S(s)) if s == "98101"));
        } else {
            panic!("Expected nested AttributeValue::M for address");
        }
    } else {
        panic!("Expected AttributeValue::M for 'customer'");
    }

    // 2. Roundtrip deserialize back to serde_json::Value
    let from_dynamo_res: Result<HashMap<String, serde_json::Value>, _> = serde_dynamo::from_item(ddb_map);
    assert!(from_dynamo_res.is_ok(), "Failed to deserialize DynamoDB attributes back to JSON");

    let restored = from_dynamo_res.unwrap();
    assert_eq!(restored.get("id"), Some(&serde_json::json!("order_999")));
    assert_eq!(restored.get("amount"), Some(&serde_json::json!(199.95)));
    assert_eq!(restored.get("isPaid"), Some(&serde_json::json!(true)));
    assert_eq!(restored.get("discountCode"), Some(&serde_json::Value::Null));
}

#[test]
fn test_batch_delete_chunking_exact_boundaries() {
    // 0 items
    let empty_keys: Vec<HashMap<String, serde_json::Value>> = vec![];
    let chunks: Vec<_> = empty_keys.chunks(25).collect();
    assert_eq!(chunks.len(), 0);

    // 25 items -> exactly 1 chunk
    let keys_25: Vec<_> = (0..25)
        .map(|i| {
            let mut m = HashMap::new();
            m.insert("id".to_string(), serde_json::json!(i));
            m
        })
        .collect();
    let chunks_25: Vec<_> = keys_25.chunks(25).collect();
    assert_eq!(chunks_25.len(), 1);
    assert_eq!(chunks_25[0].len(), 25);

    // 26 items -> 2 chunks (25 + 1)
    let keys_26: Vec<_> = (0..26)
        .map(|i| {
            let mut m = HashMap::new();
            m.insert("id".to_string(), serde_json::json!(i));
            m
        })
        .collect();
    let chunks_26: Vec<_> = keys_26.chunks(25).collect();
    assert_eq!(chunks_26.len(), 2);
    assert_eq!(chunks_26[0].len(), 25);
    assert_eq!(chunks_26[1].len(), 1);

    // 100 items -> 4 chunks (25 * 4)
    let keys_100: Vec<_> = (0..100)
        .map(|i| {
            let mut m = HashMap::new();
            m.insert("id".to_string(), serde_json::json!(i));
            m
        })
        .collect();
    let chunks_100: Vec<_> = keys_100.chunks(25).collect();
    assert_eq!(chunks_100.len(), 4);
    for chunk in chunks_100 {
        assert_eq!(chunk.len(), 25);
    }
}

#[test]
fn test_update_item_expression_attribute_marshaling() {
    let mut names = HashMap::new();
    names.insert("#status".to_string(), "status".to_string());
    names.insert("#updatedAt".to_string(), "updatedAt".to_string());

    let mut values = HashMap::new();
    values.insert(":newStatus".to_string(), serde_json::json!("COMPLETED"));
    values.insert(":ts".to_string(), serde_json::json!(1700000000));

    let attr_values_res: Result<HashMap<String, AttributeValue>, _> = serde_dynamo::to_item(values);
    assert!(attr_values_res.is_ok());
    let attr_values = attr_values_res.unwrap();

    assert!(matches!(attr_values.get(":newStatus"), Some(AttributeValue::S(s)) if s == "COMPLETED"));
    assert!(matches!(attr_values.get(":ts"), Some(AttributeValue::N(n)) if n == "1700000000"));
}
