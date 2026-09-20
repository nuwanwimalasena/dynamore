use app_lib::error::AppError;
use app_lib::models::tables::*;
use app_lib::services::DynamoService;
use aws_sdk_dynamodb::types::ScalarAttributeType;

fn create_test_client() -> aws_sdk_dynamodb::Client {
    let config = aws_sdk_dynamodb::Config::builder()
        .behavior_version(aws_sdk_dynamodb::config::BehaviorVersion::latest())
        .build();
    aws_sdk_dynamodb::Client::from_conf(config)
}

#[tokio::test]
async fn test_create_table_validation_rejects_empty_table_name() {
    let client = create_test_client();
    let req = CreateTableRequest {
        table_name: "".to_string(),
        partition_key: KeyDefinition {
            name: "id".to_string(),
            attribute_type: ScalarType::S,
        },
        sort_key: None,
        billing_mode: BillingMode::PayPerRequest,
        provisioned_throughput: None,
        global_secondary_indexes: None,
        local_secondary_indexes: None,
    };

    let res = DynamoService::create_table(&client, req).await;
    assert!(res.is_err());
    match res.unwrap_err() {
        AppError::Validation(msg) => assert!(msg.contains("Table name is required")),
        other => panic!("Expected Validation error, got {:?}", other),
    }
}

#[tokio::test]
async fn test_create_table_validation_rejects_whitespace_table_name() {
    let client = create_test_client();
    let req = CreateTableRequest {
        table_name: "    ".to_string(),
        partition_key: KeyDefinition {
            name: "id".to_string(),
            attribute_type: ScalarType::S,
        },
        sort_key: None,
        billing_mode: BillingMode::PayPerRequest,
        provisioned_throughput: None,
        global_secondary_indexes: None,
        local_secondary_indexes: None,
    };

    let res = DynamoService::create_table(&client, req).await;
    assert!(res.is_err());
}

#[tokio::test]
async fn test_create_table_validation_rejects_empty_partition_key() {
    let client = create_test_client();
    let req = CreateTableRequest {
        table_name: "TestTable".to_string(),
        partition_key: KeyDefinition {
            name: "  ".to_string(),
            attribute_type: ScalarType::S,
        },
        sort_key: None,
        billing_mode: BillingMode::PayPerRequest,
        provisioned_throughput: None,
        global_secondary_indexes: None,
        local_secondary_indexes: None,
    };

    let res = DynamoService::create_table(&client, req).await;
    assert!(res.is_err());
    match res.unwrap_err() {
        AppError::Validation(msg) => assert!(msg.contains("Partition key name is required")),
        other => panic!("Expected Validation error, got {:?}", other),
    }
}

#[tokio::test]
async fn test_describe_table_validation_rejects_empty_name() {
    let client = create_test_client();
    let res = DynamoService::describe_table(&client, "").await;
    assert!(res.is_err());
    match res.unwrap_err() {
        AppError::Validation(msg) => assert!(msg.contains("Table name cannot be empty")),
        other => panic!("Expected Validation error, got {:?}", other),
    }
}

#[tokio::test]
async fn test_delete_table_validation_rejects_empty_name() {
    let client = create_test_client();
    let res = DynamoService::delete_table(&client, "   ").await;
    assert!(res.is_err());
    match res.unwrap_err() {
        AppError::Validation(msg) => assert!(msg.contains("Table name is required")),
        other => panic!("Expected Validation error, got {:?}", other),
    }
}

#[test]
fn test_scalar_type_conversion_to_aws_types() {
    assert_eq!(ScalarType::S.as_aws(), ScalarAttributeType::S);
    assert_eq!(ScalarType::N.as_aws(), ScalarAttributeType::N);
    assert_eq!(ScalarType::B.as_aws(), ScalarAttributeType::B);
}

#[test]
fn test_table_description_serde_json_compatibility() {
    let raw_json = serde_json::json!({
        "tableName": "Users",
        "tableStatus": "ACTIVE",
        "itemCount": 42,
        "tableSizeBytes": 1024,
        "creationDateTime": "2026-08-16T12:00:00Z",
        "keySchema": [
            { "attributeName": "userId", "keyType": "HASH" },
            { "attributeName": "createdAt", "keyType": "RANGE" }
        ],
        "attributeDefinitions": [
            { "attributeName": "userId", "attributeType": "S" },
            { "attributeName": "createdAt", "attributeType": "N" }
        ],
        "billingModeSummary": { "billingMode": "PAY_PER_REQUEST" },
        "globalSecondaryIndexes": [],
        "localSecondaryIndexes": []
    });

    let parsed: Result<TableDescriptionDto, _> = serde_json::from_value(raw_json);
    assert!(parsed.is_ok());
    let dto = parsed.unwrap();
    assert_eq!(dto.table_name.as_deref(), Some("Users"));
    assert_eq!(dto.table_status.as_deref(), Some("ACTIVE"));
    assert_eq!(dto.item_count, Some(42));
    assert_eq!(dto.key_schema.len(), 2);
    assert_eq!(dto.key_schema[0].attribute_name, "userId");
    assert_eq!(dto.key_schema[0].key_type, "HASH");
}

#[test]
fn test_create_table_request_deserialization_from_frontend_payload() {
    let frontend_payload = serde_json::json!({
        "tableName": "MyNewTable",
        "partitionKey": {
            "name": "id",
            "attributeType": "S"
        },
        "sortKey": {
            "name": "timestamp",
            "attributeType": "N"
        },
        "billingMode": "PAY_PER_REQUEST"
    });

    let res: Result<CreateTableRequest, _> = serde_json::from_value(frontend_payload);
    assert!(
        res.is_ok(),
        "Failed to deserialize CreateTableRequest with 'S' and 'N'"
    );
    let req = res.unwrap();
    assert_eq!(req.table_name, "MyNewTable");
    assert_eq!(req.partition_key.attribute_type, ScalarType::S);
    assert_eq!(req.sort_key.unwrap().attribute_type, ScalarType::N);
    assert_eq!(req.billing_mode, BillingMode::PayPerRequest);
}
