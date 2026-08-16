# Domain Entities & Data Structures: Unit `aws-sdk-fix`

## 1. Managed AWS Client Cache Entity

```rust
pub struct CachedClient {
    pub client: aws_sdk_dynamodb::Client,
    pub region: String,
    pub session_fingerprint: String,
    pub created_at: std::time::Instant,
}

pub struct AwsClientState {
    pub ddb_client: tokio::sync::RwLock<Option<CachedClient>>,
}
```

### Entity Attributes & Invalidation Key
- `ddb_client`: Asynchronous Read-Write Lock (`tokio::sync::RwLock`) wrapping an optional `CachedClient`.
- `session_fingerprint`: Hash/Digest combining `access_key_id`, `region`, and `session_token` (or SSO session expiry) to immediately detect changes in user session credentials.

---

## 2. Standardized Tauri Command IPC Contracts

### Response Model
All commands adhere to Rust's native `Result<T, String>` return type.
- **Success (`Ok(T)`)**: Serialized directly to JSON over the Tauri IPC channel.
- **Failure (`Err(String)`)**: Emitted as an IPC rejection, causing the frontend `invoke()` Promise to reject with the error message string.

### Query & Scan Result Data Models

```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QueryResultPayload {
    pub items: Vec<serde_json::Value>,
    pub count: i32,
    pub scanned_count: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_evaluated_key: Option<HashMap<String, serde_json::Value>>,
}
```

### Query & Scan Parameter Entities

```rust
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QueryParamsInput {
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
pub struct ScanParamsInput {
    pub table_name: String,
    pub index_name: Option<String>,
    pub filter_expression: Option<String>,
    pub projection_expression: Option<String>,
    pub expression_attribute_names: Option<HashMap<String, String>>,
    pub expression_attribute_values: Option<HashMap<String, serde_json::Value>>,
    pub limit: Option<i32>,
    pub exclusive_start_key: Option<HashMap<String, serde_json::Value>>,
}
```

---

## 3. Table & Schema Data Entities

```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TableDescriptionDto {
    pub table_name: String,
    pub table_status: String,
    pub item_count: Option<i64>,
    pub table_size_bytes: Option<i64>,
    pub creation_date_time: Option<String>,
    pub billing_mode: String,
    pub read_capacity_units: Option<i64>,
    pub write_capacity_units: Option<i64>,
    pub key_schema: Vec<KeySchemaDto>,
    pub attribute_definitions: Vec<AttributeDefinitionDto>,
    pub global_secondary_indexes: Vec<SecondaryIndexDto>,
    pub local_secondary_indexes: Vec<SecondaryIndexDto>,
}
```

---

## 4. Item CRUD Operation Models

```rust
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ItemUpdateInput {
    pub table_name: String,
    pub key: serde_json::Value,
    pub update_expression: Option<String>,
    pub expression_attribute_names: Option<HashMap<String, String>>,
    pub expression_attribute_values: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BatchDeleteResult {
    pub deleted_count: usize,
}
```
