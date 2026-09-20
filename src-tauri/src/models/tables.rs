use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ScalarType {
    #[serde(alias = "s", alias = "string", alias = "String")]
    S,
    #[serde(alias = "n", alias = "number", alias = "Number")]
    N,
    #[serde(alias = "b", alias = "binary", alias = "Binary")]
    B,
}

impl ScalarType {
    pub fn as_aws(&self) -> aws_sdk_dynamodb::types::ScalarAttributeType {
        match self {
            ScalarType::S => aws_sdk_dynamodb::types::ScalarAttributeType::S,
            ScalarType::N => aws_sdk_dynamodb::types::ScalarAttributeType::N,
            ScalarType::B => aws_sdk_dynamodb::types::ScalarAttributeType::B,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KeyDefinition {
    pub name: String,
    pub attribute_type: ScalarType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BillingMode {
    #[serde(alias = "PAY_PER_REQUEST", alias = "payPerRequest", alias = "PAYPERREQUEST", alias = "OnDemand", alias = "ON_DEMAND")]
    PayPerRequest,
    #[serde(alias = "PROVISIONED", alias = "provisioned", alias = "Provisioned")]
    Provisioned,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvisionedCapacity {
    pub read_capacity_units: i64,
    pub write_capacity_units: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GsiDefinition {
    pub index_name: String,
    pub partition_key: KeyDefinition,
    pub sort_key: Option<KeyDefinition>,
    #[serde(default = "default_projection_type")]
    pub projection_type: String,
    pub non_key_attributes: Option<Vec<String>>,
    pub provisioned_throughput: Option<ProvisionedCapacity>,
}

fn default_projection_type() -> String {
    "ALL".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LsiDefinition {
    pub index_name: String,
    pub sort_key: KeyDefinition,
    #[serde(default = "default_projection_type")]
    pub projection_type: String,
    pub non_key_attributes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTableRequest {
    pub table_name: String,
    pub partition_key: KeyDefinition,
    pub sort_key: Option<KeyDefinition>,
    #[serde(default = "default_billing_mode")]
    pub billing_mode: BillingMode,
    pub provisioned_throughput: Option<ProvisionedCapacity>,
    pub global_secondary_indexes: Option<Vec<GsiDefinition>>,
    pub local_secondary_indexes: Option<Vec<LsiDefinition>>,
}

fn default_billing_mode() -> BillingMode {
    BillingMode::PayPerRequest
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeySchemaItemDto {
    pub attribute_name: String,
    pub key_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttributeDefinitionDto {
    pub attribute_name: String,
    pub attribute_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionDto {
    pub projection_type: Option<String>,
    pub non_key_attributes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GsiDescriptionDto {
    pub index_name: Option<String>,
    pub index_status: Option<String>,
    pub key_schema: Vec<KeySchemaItemDto>,
    pub projection: Option<ProjectionDto>,
    pub provisioned_throughput: Option<ProvisionedCapacity>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LsiDescriptionDto {
    pub index_name: Option<String>,
    pub key_schema: Vec<KeySchemaItemDto>,
    pub projection: Option<ProjectionDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BillingModeSummaryDto {
    pub billing_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableDescriptionDto {
    pub table_name: Option<String>,
    pub table_status: Option<String>,
    pub item_count: Option<i64>,
    pub table_size_bytes: Option<i64>,
    pub creation_date_time: Option<String>,
    pub key_schema: Vec<KeySchemaItemDto>,
    pub attribute_definitions: Vec<AttributeDefinitionDto>,
    pub billing_mode_summary: Option<BillingModeSummaryDto>,
    pub provisioned_throughput: Option<ProvisionedCapacity>,
    pub global_secondary_indexes: Vec<GsiDescriptionDto>,
    pub local_secondary_indexes: Vec<LsiDescriptionDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableListResponse {
    pub success: bool,
    pub table_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableDescribeResponse {
    pub success: bool,
    pub table: Option<TableDescriptionDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableCreateResponse {
    pub success: bool,
    pub table: Option<TableDescriptionDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableDeleteResponse {
    pub success: bool,
}
