use crate::error::AppError;
use crate::models::items::*;
use crate::models::query::*;
use crate::models::tables::*;
use aws_sdk_dynamodb::types::{
    AttributeDefinition, AttributeValue, BillingMode as AwsBillingMode, DeleteRequest,
    GlobalSecondaryIndex, KeySchemaElement, KeyType, LocalSecondaryIndex, Projection,
    ProjectionType, ProvisionedThroughput, TableDescription, WriteRequest,
};
use aws_sdk_dynamodb::Client as DynamoDbClient;
use std::collections::{HashMap, HashSet};
use tokio::time::{sleep, Duration};

pub struct DynamoService;

impl DynamoService {
    // -------------------------------------------------------------------------
    // Tables
    // -------------------------------------------------------------------------

    pub async fn list_tables(client: &DynamoDbClient) -> Result<TableListResponse, AppError> {
        let mut table_names = Vec::new();
        let mut last_evaluated_table_name = None;

        loop {
            let mut request = client.list_tables();
            if let Some(name) = last_evaluated_table_name {
                request = request.exclusive_start_table_name(name);
            }

            let res = request.send().await?;
            if let Some(names) = res.table_names {
                table_names.extend(names);
            }

            last_evaluated_table_name = res.last_evaluated_table_name;
            if last_evaluated_table_name.is_none() {
                break;
            }
        }

        Ok(TableListResponse {
            success: true,
            table_names,
        })
    }

    pub async fn describe_table(
        client: &DynamoDbClient,
        table_name: &str,
    ) -> Result<TableDescribeResponse, AppError> {
        if table_name.trim().is_empty() {
            return Err(AppError::Validation("Table name cannot be empty".into()));
        }

        let res = client
            .describe_table()
            .table_name(table_name)
            .send()
            .await?;

        let table = res.table().map(Self::map_table_description);

        Ok(TableDescribeResponse {
            success: true,
            table,
        })
    }

    pub async fn create_table(
        client: &DynamoDbClient,
        req: CreateTableRequest,
    ) -> Result<TableCreateResponse, AppError> {
        let table_name = req.table_name.trim();
        if table_name.is_empty() {
            return Err(AppError::Validation("Table name is required".into()));
        }
        if req.partition_key.name.trim().is_empty() {
            return Err(AppError::Validation("Partition key name is required".into()));
        }

        let mut builder = client.create_table().table_name(table_name);

        // Attribute definitions map (Name -> ScalarType)
        let mut attribute_defs: HashMap<String, ScalarType> = HashMap::new();
        let mut referenced_keys: HashSet<String> = HashSet::new();

        // 1. Table Key Schema
        let pk_name = req.partition_key.name.trim().to_string();
        referenced_keys.insert(pk_name.clone());
        attribute_defs.insert(pk_name.clone(), req.partition_key.attribute_type.clone());

        builder = builder.key_schema(
            KeySchemaElement::builder()
                .attribute_name(&pk_name)
                .key_type(KeyType::Hash)
                .build()
                .map_err(|e| AppError::Validation(format!("Failed to build PartitionKey: {}", e)))?,
        );

        if let Some(ref sk) = req.sort_key {
            let sk_name = sk.name.trim().to_string();
            if !sk_name.is_empty() && sk_name != pk_name {
                referenced_keys.insert(sk_name.clone());
                attribute_defs.insert(sk_name.clone(), sk.attribute_type.clone());

                builder = builder.key_schema(
                    KeySchemaElement::builder()
                        .attribute_name(&sk_name)
                        .key_type(KeyType::Range)
                        .build()
                        .map_err(|e| AppError::Validation(format!("Failed to build SortKey: {}", e)))?,
                );
            }
        }

        // 2. Billing Mode & Throughput
        let is_on_demand = matches!(req.billing_mode, BillingMode::PayPerRequest);
        if is_on_demand {
            builder = builder.billing_mode(AwsBillingMode::PayPerRequest);
        } else {
            builder = builder.billing_mode(AwsBillingMode::Provisioned);
            let throughput = req.provisioned_throughput.unwrap_or(ProvisionedCapacity {
                read_capacity_units: 5,
                write_capacity_units: 5,
            });

            builder = builder.provisioned_throughput(
                ProvisionedThroughput::builder()
                    .read_capacity_units(std::cmp::max(1, throughput.read_capacity_units))
                    .write_capacity_units(std::cmp::max(1, throughput.write_capacity_units))
                    .build()
                    .map_err(|e| AppError::Validation(format!("Failed to build ProvisionedThroughput: {}", e)))?,
            );
        }

        // 3. Global Secondary Indexes
        if let Some(gsis) = req.global_secondary_indexes {
            for gsi in gsis {
                let mut gsi_builder = GlobalSecondaryIndex::builder()
                    .index_name(gsi.index_name.trim());

                let gsi_pk_name = gsi.partition_key.name.trim().to_string();
                referenced_keys.insert(gsi_pk_name.clone());
                attribute_defs.insert(gsi_pk_name.clone(), gsi.partition_key.attribute_type);

                gsi_builder = gsi_builder.key_schema(
                    KeySchemaElement::builder()
                        .attribute_name(&gsi_pk_name)
                        .key_type(KeyType::Hash)
                        .build()
                        .map_err(|e| AppError::Validation(format!("Failed to build GSI Hash Key: {}", e)))?,
                );

                if let Some(ref gsi_sk) = gsi.sort_key {
                    let gsi_sk_name = gsi_sk.name.trim().to_string();
                    if !gsi_sk_name.is_empty() {
                        referenced_keys.insert(gsi_sk_name.clone());
                        attribute_defs.insert(gsi_sk_name.clone(), gsi_sk.attribute_type.clone());

                        gsi_builder = gsi_builder.key_schema(
                            KeySchemaElement::builder()
                                .attribute_name(&gsi_sk_name)
                                .key_type(KeyType::Range)
                                .build()
                                .map_err(|e| AppError::Validation(format!("Failed to build GSI Range Key: {}", e)))?,
                        );
                    }
                }

                let proj_type = match gsi.projection_type.to_uppercase().as_str() {
                    "KEYS_ONLY" => ProjectionType::KeysOnly,
                    "INCLUDE" => ProjectionType::Include,
                    _ => ProjectionType::All,
                };
                let mut proj_builder = Projection::builder().projection_type(proj_type);
                if let Some(non_keys) = gsi.non_key_attributes {
                    for nk in non_keys {
                        proj_builder = proj_builder.non_key_attributes(nk);
                    }
                }
                gsi_builder = gsi_builder.projection(proj_builder.build());

                if !is_on_demand {
                    let gsi_tp = gsi.provisioned_throughput.unwrap_or(ProvisionedCapacity {
                        read_capacity_units: 5,
                        write_capacity_units: 5,
                    });
                    gsi_builder = gsi_builder.provisioned_throughput(
                        ProvisionedThroughput::builder()
                            .read_capacity_units(std::cmp::max(1, gsi_tp.read_capacity_units))
                            .write_capacity_units(std::cmp::max(1, gsi_tp.write_capacity_units))
                            .build()
                            .map_err(|e| AppError::Validation(format!("Failed to build GSI Throughput: {}", e)))?,
                    );
                }

                builder = builder.global_secondary_indexes(
                    gsi_builder.build().map_err(|e| {
                        AppError::Validation(format!("Failed to build GlobalSecondaryIndex: {}", e))
                    })?,
                );
            }
        }

        // 4. Local Secondary Indexes
        if let Some(lsis) = req.local_secondary_indexes {
            for lsi in lsis {
                let mut lsi_builder = LocalSecondaryIndex::builder()
                    .index_name(lsi.index_name.trim());

                // Table PK is also LSI PK
                lsi_builder = lsi_builder.key_schema(
                    KeySchemaElement::builder()
                        .attribute_name(&pk_name)
                        .key_type(KeyType::Hash)
                        .build()
                        .map_err(|e| AppError::Validation(format!("Failed to build LSI Hash Key: {}", e)))?,
                );

                let lsi_sk_name = lsi.sort_key.name.trim().to_string();
                referenced_keys.insert(lsi_sk_name.clone());
                attribute_defs.insert(lsi_sk_name.clone(), lsi.sort_key.attribute_type);

                lsi_builder = lsi_builder.key_schema(
                    KeySchemaElement::builder()
                        .attribute_name(&lsi_sk_name)
                        .key_type(KeyType::Range)
                        .build()
                        .map_err(|e| AppError::Validation(format!("Failed to build LSI Range Key: {}", e)))?,
                );

                let proj_type = match lsi.projection_type.to_uppercase().as_str() {
                    "KEYS_ONLY" => ProjectionType::KeysOnly,
                    "INCLUDE" => ProjectionType::Include,
                    _ => ProjectionType::All,
                };
                let mut proj_builder = Projection::builder().projection_type(proj_type);
                if let Some(non_keys) = lsi.non_key_attributes {
                    for nk in non_keys {
                        proj_builder = proj_builder.non_key_attributes(nk);
                    }
                }
                lsi_builder = lsi_builder.projection(proj_builder.build());

                builder = builder.local_secondary_indexes(
                    lsi_builder.build().map_err(|e| {
                        AppError::Validation(format!("Failed to build LocalSecondaryIndex: {}", e))
                    })?,
                );
            }
        }

        // 5. Build strict, required AttributeDefinitions only for referenced keys
        for key_name in &referenced_keys {
            let attr_type = attribute_defs.get(key_name).cloned().unwrap_or(ScalarType::S);
            builder = builder.attribute_definitions(
                AttributeDefinition::builder()
                    .attribute_name(key_name)
                    .attribute_type(attr_type.as_aws())
                    .build()
                    .map_err(|e| AppError::Validation(format!("Failed to build AttributeDefinition: {}", e)))?,
            );
        }

        let res = builder.send().await?;
        let table = res.table_description().map(Self::map_table_description);

        Ok(TableCreateResponse {
            success: true,
            table,
        })
    }

    pub async fn delete_table(
        client: &DynamoDbClient,
        table_name: &str,
    ) -> Result<TableDeleteResponse, AppError> {
        if table_name.trim().is_empty() {
            return Err(AppError::Validation("Table name is required".into()));
        }

        client.delete_table().table_name(table_name).send().await?;

        Ok(TableDeleteResponse { success: true })
    }

    // -------------------------------------------------------------------------
    // Items
    // -------------------------------------------------------------------------

    pub async fn put_item(
        client: &DynamoDbClient,
        req: PutItemRequest,
    ) -> Result<MutationResponse, AppError> {
        let item_map: HashMap<String, AttributeValue> = serde_dynamo::to_item(req.item)?;

        client
            .put_item()
            .table_name(req.table_name)
            .set_item(Some(item_map))
            .send()
            .await?;

        Ok(MutationResponse { success: true })
    }

    pub async fn get_item(
        client: &DynamoDbClient,
        req: GetItemRequest,
    ) -> Result<ItemResponse, AppError> {
        let key_map: HashMap<String, AttributeValue> = serde_dynamo::to_item(req.key)?;

        let res = client
            .get_item()
            .table_name(req.table_name)
            .set_key(Some(key_map))
            .consistent_read(true)
            .send()
            .await?;

        let item = if let Some(dynamo_item) = res.item {
            let parsed: HashMap<String, serde_json::Value> = serde_dynamo::from_item(dynamo_item)?;
            Some(parsed)
        } else {
            None
        };

        Ok(ItemResponse {
            success: true,
            item,
        })
    }

    pub async fn update_item(
        client: &DynamoDbClient,
        req: UpdateItemRequest,
    ) -> Result<ItemResponse, AppError> {
        let key_map: HashMap<String, AttributeValue> = serde_dynamo::to_item(req.key)?;

        let mut builder = client
            .update_item()
            .table_name(req.table_name)
            .set_key(Some(key_map));

        if let Some(expr) = req.update_expression {
            builder = builder.update_expression(expr);
        }
        if let Some(names) = req.expression_attribute_names {
            for (k, v) in names {
                builder = builder.expression_attribute_names(k, v);
            }
        }
        if let Some(values) = req.expression_attribute_values {
            let attr_values: HashMap<String, AttributeValue> = serde_dynamo::to_item(values)?;
            builder = builder.set_expression_attribute_values(Some(attr_values));
        }

        let res = builder.send().await?;

        let item = if let Some(attrs) = res.attributes {
            let parsed: HashMap<String, serde_json::Value> = serde_dynamo::from_item(attrs)?;
            Some(parsed)
        } else {
            None
        };

        Ok(ItemResponse {
            success: true,
            item,
        })
    }

    pub async fn delete_item(
        client: &DynamoDbClient,
        req: DeleteItemRequest,
    ) -> Result<MutationResponse, AppError> {
        let key_map: HashMap<String, AttributeValue> = serde_dynamo::to_item(req.key)?;

        client
            .delete_item()
            .table_name(req.table_name)
            .set_key(Some(key_map))
            .send()
            .await?;

        Ok(MutationResponse { success: true })
    }

    pub async fn batch_delete_items(
        client: &DynamoDbClient,
        req: BatchDeleteItemsRequest,
    ) -> Result<MutationResponse, AppError> {
        if req.keys.is_empty() {
            return Ok(MutationResponse { success: true });
        }

        // DynamoDB BatchWriteItem processes max 25 items per batch
        for chunk in req.keys.chunks(25) {
            let mut write_requests = Vec::new();
            for k in chunk {
                let key_item: HashMap<String, AttributeValue> = serde_dynamo::to_item(k.clone())?;
                let del_req = DeleteRequest::builder()
                    .set_key(Some(key_item))
                    .build()
                    .map_err(|e| AppError::Validation(format!("Failed to build DeleteRequest: {}", e)))?;
                let wr = WriteRequest::builder().delete_request(del_req).build();
                write_requests.push(wr);
            }

            let mut request_items = HashMap::new();
            request_items.insert(req.table_name.clone(), write_requests);

            let mut retry_count = 0;
            const MAX_RETRIES: usize = 5;

            while !request_items.is_empty() {
                let res = client
                    .batch_write_item()
                    .set_request_items(Some(request_items.clone()))
                    .send()
                    .await?;

                if let Some(unprocessed) = res.unprocessed_items {
                    if !unprocessed.is_empty() && unprocessed.contains_key(&req.table_name) {
                        retry_count += 1;
                        if retry_count > MAX_RETRIES {
                            return Err(AppError::AwsService {
                                code: "ProvisionedThroughputExceededException".to_string(),
                                message: "Exceeded max retries for unprocessed items in batch delete".to_string(),
                            });
                        }
                        let backoff_ms = 50 * (1 << retry_count);
                        sleep(Duration::from_millis(backoff_ms)).await;
                        request_items = unprocessed;
                        continue;
                    }
                }
                break;
            }
        }

        Ok(MutationResponse { success: true })
    }

    // -------------------------------------------------------------------------
    // Query & Scan
    // -------------------------------------------------------------------------

    pub async fn execute_query(
        client: &DynamoDbClient,
        req: QueryRequest,
    ) -> Result<QueryResultDto, AppError> {
        let target_limit = req.limit.unwrap_or(50).clamp(1, 1000);
        let has_filter = req.filter_expression.is_some();
        let max_iterations = if has_filter { 10 } else { 1 };

        let mut accumulated_items = Vec::new();
        let mut total_scanned = 0;
        let mut current_start_key: Option<HashMap<String, AttributeValue>> = if let Some(sk) = req.exclusive_start_key {
            Some(serde_dynamo::to_item(sk)?)
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
                .table_name(&req.table_name)
                .key_condition_expression(&req.key_condition_expression);

            if let Some(ref index) = req.index_name {
                builder = builder.index_name(index);
            }
            if let Some(ref filter) = req.filter_expression {
                builder = builder.filter_expression(filter);
            }
            if let Some(ref proj) = req.projection_expression {
                builder = builder.projection_expression(proj);
            }
            if let Some(ref names) = req.expression_attribute_names {
                for (k, v) in names {
                    builder = builder.expression_attribute_names(k, v);
                }
            }
            if let Some(ref values) = req.expression_attribute_values {
                let attr_values: HashMap<String, AttributeValue> = serde_dynamo::to_item(values.clone())?;
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
            if let Some(forward) = req.scan_index_forward {
                builder = builder.scan_index_forward(forward);
            }

            let res = builder.send().await?;
            total_scanned += res.scanned_count;

            if let Some(dynamo_items) = res.items {
                let parsed_items: Vec<HashMap<String, serde_json::Value>> =
                    serde_dynamo::from_items(dynamo_items)?;
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
            Some(serde_dynamo::from_item(key)?)
        } else {
            None
        };

        Ok(QueryResultDto {
            count: accumulated_items.len() as i32,
            scanned_count: total_scanned,
            items: accumulated_items,
            last_evaluated_key: parsed_last_key,
        })
    }

    pub async fn execute_scan(
        client: &DynamoDbClient,
        req: ScanRequest,
    ) -> Result<QueryResultDto, AppError> {
        let target_limit = req.limit.unwrap_or(50).clamp(1, 1000);
        let has_filter = req.filter_expression.is_some();
        let max_iterations = if has_filter { 10 } else { 1 };

        let mut accumulated_items = Vec::new();
        let mut total_scanned = 0;
        let mut current_start_key: Option<HashMap<String, AttributeValue>> = if let Some(sk) = req.exclusive_start_key {
            Some(serde_dynamo::to_item(sk)?)
        } else {
            None
        };
        let mut final_last_evaluated_key = None;

        for _iteration in 0..max_iterations {
            let remaining_needed = target_limit.saturating_sub(accumulated_items.len());
            if remaining_needed == 0 {
                break;
            }

            let mut builder = client.scan().table_name(&req.table_name);

            if let Some(ref index) = req.index_name {
                builder = builder.index_name(index);
            }
            if let Some(ref filter) = req.filter_expression {
                builder = builder.filter_expression(filter);
            }
            if let Some(ref proj) = req.projection_expression {
                builder = builder.projection_expression(proj);
            }
            if let Some(ref names) = req.expression_attribute_names {
                for (k, v) in names {
                    builder = builder.expression_attribute_names(k, v);
                }
            }
            if let Some(ref values) = req.expression_attribute_values {
                let attr_values: HashMap<String, AttributeValue> = serde_dynamo::to_item(values.clone())?;
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

            let res = builder.send().await?;
            total_scanned += res.scanned_count;

            if let Some(dynamo_items) = res.items {
                let parsed_items: Vec<HashMap<String, serde_json::Value>> =
                    serde_dynamo::from_items(dynamo_items)?;
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
            Some(serde_dynamo::from_item(key)?)
        } else {
            None
        };

        Ok(QueryResultDto {
            count: accumulated_items.len() as i32,
            scanned_count: total_scanned,
            items: accumulated_items,
            last_evaluated_key: parsed_last_key,
        })
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    fn map_table_description(td: &TableDescription) -> TableDescriptionDto {
        let key_schema = td
            .key_schema()
            .iter()
            .map(|k| KeySchemaItemDto {
                attribute_name: k.attribute_name().to_string(),
                key_type: k.key_type().as_str().to_string(),
            })
            .collect();

        let attribute_definitions = td
            .attribute_definitions()
            .iter()
            .map(|a| AttributeDefinitionDto {
                attribute_name: a.attribute_name().to_string(),
                attribute_type: a.attribute_type().as_str().to_string(),
            })
            .collect();

        let billing_mode_summary = td.billing_mode_summary().and_then(|b| {
            b.billing_mode()
                .map(|mode| BillingModeSummaryDto {
                    billing_mode: mode.as_str().to_string(),
                })
        });

        let provisioned_throughput = td.provisioned_throughput().map(|pt| ProvisionedCapacity {
            read_capacity_units: pt.read_capacity_units().unwrap_or(0),
            write_capacity_units: pt.write_capacity_units().unwrap_or(0),
        });

        let global_secondary_indexes = td
            .global_secondary_indexes()
            .iter()
            .map(|g| GsiDescriptionDto {
                index_name: g.index_name().map(|s| s.to_string()),
                index_status: g.index_status().map(|s| s.as_str().to_string()),
                key_schema: g
                    .key_schema()
                    .iter()
                    .map(|k| KeySchemaItemDto {
                        attribute_name: k.attribute_name().to_string(),
                        key_type: k.key_type().as_str().to_string(),
                    })
                    .collect(),
                projection: g.projection().map(|p| ProjectionDto {
                    projection_type: p.projection_type().map(|pt| pt.as_str().to_string()),
                    non_key_attributes: if p.non_key_attributes().is_empty() {
                        None
                    } else {
                        Some(p.non_key_attributes().iter().map(|s| s.to_string()).collect())
                    },
                }),
                provisioned_throughput: g.provisioned_throughput().map(|pt| ProvisionedCapacity {
                    read_capacity_units: pt.read_capacity_units().unwrap_or(0),
                    write_capacity_units: pt.write_capacity_units().unwrap_or(0),
                }),
            })
            .collect();

        let local_secondary_indexes = td
            .local_secondary_indexes()
            .iter()
            .map(|l| LsiDescriptionDto {
                index_name: l.index_name().map(|s| s.to_string()),
                key_schema: l
                    .key_schema()
                    .iter()
                    .map(|k| KeySchemaItemDto {
                        attribute_name: k.attribute_name().to_string(),
                        key_type: k.key_type().as_str().to_string(),
                    })
                    .collect(),
                projection: l.projection().map(|p| ProjectionDto {
                    projection_type: p.projection_type().map(|pt| pt.as_str().to_string()),
                    non_key_attributes: if p.non_key_attributes().is_empty() {
                        None
                    } else {
                        Some(p.non_key_attributes().iter().map(|s| s.to_string()).collect())
                    },
                }),
            })
            .collect();

        TableDescriptionDto {
            table_name: td.table_name().map(|s| s.to_string()),
            table_status: td.table_status().map(|s| s.as_str().to_string()),
            item_count: td.item_count(),
            table_size_bytes: td.table_size_bytes(),
            creation_date_time: td.creation_date_time().map(|d| d.to_string()),
            key_schema,
            attribute_definitions,
            billing_mode_summary,
            provisioned_throughput,
            global_secondary_indexes,
            local_secondary_indexes,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_client() -> DynamoDbClient {
        let config = aws_sdk_dynamodb::Config::builder()
            .behavior_version(aws_sdk_dynamodb::config::BehaviorVersion::latest())
            .build();
        DynamoDbClient::from_conf(config)
    }

    #[tokio::test]
    async fn test_create_table_validates_table_name() {
        let client = create_test_client();
        let req = CreateTableRequest {
            table_name: "   ".to_string(),
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

        let result = DynamoService::create_table(&client, req).await;
        assert!(matches!(result, Err(AppError::Validation(_))));
    }

    #[tokio::test]
    async fn test_create_table_validates_partition_key() {
        let client = create_test_client();
        let req = CreateTableRequest {
            table_name: "ValidTable".to_string(),
            partition_key: KeyDefinition {
                name: "".to_string(),
                attribute_type: ScalarType::S,
            },
            sort_key: None,
            billing_mode: BillingMode::PayPerRequest,
            provisioned_throughput: None,
            global_secondary_indexes: None,
            local_secondary_indexes: None,
        };

        let result = DynamoService::create_table(&client, req).await;
        assert!(matches!(result, Err(AppError::Validation(_))));
    }

    #[test]
    fn test_item_serde_marshaling() {
        let mut raw_item = HashMap::new();
        raw_item.insert("id".to_string(), serde_json::json!("user_123"));
        raw_item.insert("age".to_string(), serde_json::json!(30));
        raw_item.insert("isActive".to_string(), serde_json::json!(true));
        raw_item.insert("roles".to_string(), serde_json::json!(["admin", "editor"]));
        raw_item.insert("metadata".to_string(), serde_json::json!({ "theme": "dark" }));

        // Test serialization to DynamoDB AttributeValues
        let av_map: Result<HashMap<String, AttributeValue>, _> = serde_dynamo::to_item(raw_item.clone());
        assert!(av_map.is_ok());
        let map = av_map.unwrap();

        assert!(matches!(map.get("id"), Some(AttributeValue::S(s)) if s == "user_123"));
        assert!(matches!(map.get("age"), Some(AttributeValue::N(n)) if n == "30"));
        assert!(matches!(map.get("isActive"), Some(AttributeValue::Bool(true))));
        assert!(matches!(map.get("roles"), Some(AttributeValue::L(_))));
        assert!(matches!(map.get("metadata"), Some(AttributeValue::M(_))));

        // Test roundtrip deserialization
        let roundtrip: Result<HashMap<String, serde_json::Value>, _> = serde_dynamo::from_item(map);
        assert!(roundtrip.is_ok());
        let deserialized = roundtrip.unwrap();
        assert_eq!(deserialized.get("id"), Some(&serde_json::json!("user_123")));
        assert_eq!(deserialized.get("age"), Some(&serde_json::json!(30)));
        assert_eq!(deserialized.get("isActive"), Some(&serde_json::json!(true)));
    }

    #[test]
    fn test_batch_delete_chunking() {
        let mut keys = Vec::new();
        for i in 0..65 {
            let mut k = HashMap::new();
            k.insert("id".to_string(), serde_json::json!(format!("item_{}", i)));
            keys.push(k);
        }

        let chunks: Vec<_> = keys.chunks(25).collect();
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].len(), 25);
        assert_eq!(chunks[1].len(), 25);
        assert_eq!(chunks[2].len(), 15);
    }
}

