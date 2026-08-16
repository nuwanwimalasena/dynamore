use crate::aws_client::{get_dynamodb_client, sanitize_error_message, AwsClientState};
use aws_sdk_dynamodb::types::{
    AttributeDefinition, BillingMode, GlobalSecondaryIndex, KeySchemaElement, KeyType,
    LocalSecondaryIndex, Projection, ProjectionType, ProvisionedThroughput, ScalarAttributeType,
    TableDescription,
};
use serde_json::{json, Value};
use tauri::{AppHandle, State};

fn map_table_description(td: &TableDescription) -> Value {
    let mut map = serde_json::Map::new();

    if let Some(name) = td.table_name() {
        map.insert("tableName".to_string(), json!(name));
        map.insert("TableName".to_string(), json!(name));
    }
    if let Some(status) = td.table_status() {
        map.insert("tableStatus".to_string(), json!(status.as_str()));
        map.insert("TableStatus".to_string(), json!(status.as_str()));
    }
    if let Some(count) = td.item_count() {
        map.insert("itemCount".to_string(), json!(count));
        map.insert("ItemCount".to_string(), json!(count));
    }
    if let Some(size) = td.table_size_bytes() {
        map.insert("tableSizeBytes".to_string(), json!(size));
        map.insert("TableSizeBytes".to_string(), json!(size));
    }

    if let Some(billing) = td.billing_mode_summary() {
        if let Some(mode) = billing.billing_mode() {
            map.insert(
                "billingModeSummary".to_string(),
                json!({ "billingMode": mode.as_str(), "BillingMode": mode.as_str() }),
            );
            map.insert(
                "BillingModeSummary".to_string(),
                json!({ "billingMode": mode.as_str(), "BillingMode": mode.as_str() }),
            );
        }
    }

    if let Some(pt) = td.provisioned_throughput() {
        let mut pt_map = serde_json::Map::new();
        if let Some(read) = pt.read_capacity_units() {
            pt_map.insert("readCapacityUnits".to_string(), json!(read));
            pt_map.insert("ReadCapacityUnits".to_string(), json!(read));
        }
        if let Some(write) = pt.write_capacity_units() {
            pt_map.insert("writeCapacityUnits".to_string(), json!(write));
            pt_map.insert("WriteCapacityUnits".to_string(), json!(write));
        }
        map.insert("provisionedThroughput".to_string(), Value::Object(pt_map.clone()));
        map.insert("ProvisionedThroughput".to_string(), Value::Object(pt_map));
    }

    let schema = td.key_schema();
    if !schema.is_empty() {
        let schema_json: Vec<Value> = schema
            .iter()
            .map(|k| {
                json!({
                    "attributeName": k.attribute_name(),
                    "AttributeName": k.attribute_name(),
                    "keyType": k.key_type().as_str(),
                    "KeyType": k.key_type().as_str(),
                })
            })
            .collect();
        map.insert("keySchema".to_string(), Value::Array(schema_json.clone()));
        map.insert("KeySchema".to_string(), Value::Array(schema_json));
    }

    let attrs = td.attribute_definitions();
    if !attrs.is_empty() {
        let attrs_json: Vec<Value> = attrs
            .iter()
            .map(|a| {
                json!({
                    "attributeName": a.attribute_name(),
                    "AttributeName": a.attribute_name(),
                    "attributeType": a.attribute_type().as_str(),
                    "AttributeType": a.attribute_type().as_str(),
                })
            })
            .collect();
        map.insert("attributeDefinitions".to_string(), Value::Array(attrs_json.clone()));
        map.insert("AttributeDefinitions".to_string(), Value::Array(attrs_json));
    }

    let gsi = td.global_secondary_indexes();
    if !gsi.is_empty() {
        let gsi_json: Vec<Value> = gsi
            .iter()
            .map(|g| {
                let mut g_map = serde_json::Map::new();
                if let Some(name) = g.index_name() {
                    g_map.insert("indexName".to_string(), json!(name));
                    g_map.insert("IndexName".to_string(), json!(name));
                }
                if let Some(status) = g.index_status() {
                    g_map.insert("indexStatus".to_string(), json!(status.as_str()));
                    g_map.insert("IndexStatus".to_string(), json!(status.as_str()));
                }
                let schema = g.key_schema();
                if !schema.is_empty() {
                    let schema_json: Vec<Value> = schema
                        .iter()
                        .map(|k| {
                            json!({
                                "attributeName": k.attribute_name(),
                                "AttributeName": k.attribute_name(),
                                "keyType": k.key_type().as_str(),
                                "KeyType": k.key_type().as_str(),
                            })
                        })
                        .collect();
                    g_map.insert("keySchema".to_string(), Value::Array(schema_json.clone()));
                    g_map.insert("KeySchema".to_string(), Value::Array(schema_json));
                }
                if let Some(proj) = g.projection() {
                    let mut p_map = serde_json::Map::new();
                    if let Some(pt) = proj.projection_type() {
                        p_map.insert("projectionType".to_string(), json!(pt.as_str()));
                        p_map.insert("ProjectionType".to_string(), json!(pt.as_str()));
                    }
                    let non_key = proj.non_key_attributes();
                    if !non_key.is_empty() {
                        p_map.insert("nonKeyAttributes".to_string(), json!(non_key));
                        p_map.insert("NonKeyAttributes".to_string(), json!(non_key));
                    }
                    g_map.insert("projection".to_string(), Value::Object(p_map.clone()));
                    g_map.insert("Projection".to_string(), Value::Object(p_map));
                }
                if let Some(pt) = g.provisioned_throughput() {
                    let mut pt_map = serde_json::Map::new();
                    if let Some(read) = pt.read_capacity_units() {
                        pt_map.insert("readCapacityUnits".to_string(), json!(read));
                        pt_map.insert("ReadCapacityUnits".to_string(), json!(read));
                    }
                    if let Some(write) = pt.write_capacity_units() {
                        pt_map.insert("writeCapacityUnits".to_string(), json!(write));
                        pt_map.insert("WriteCapacityUnits".to_string(), json!(write));
                    }
                    g_map.insert("provisionedThroughput".to_string(), Value::Object(pt_map.clone()));
                    g_map.insert("ProvisionedThroughput".to_string(), Value::Object(pt_map));
                }
                Value::Object(g_map)
            })
            .collect();
        map.insert("globalSecondaryIndexes".to_string(), Value::Array(gsi_json.clone()));
        map.insert("GlobalSecondaryIndexes".to_string(), Value::Array(gsi_json));
    }

    let lsi = td.local_secondary_indexes();
    if !lsi.is_empty() {
        let lsi_json: Vec<Value> = lsi
            .iter()
            .map(|l| {
                let mut l_map = serde_json::Map::new();
                if let Some(name) = l.index_name() {
                    l_map.insert("indexName".to_string(), json!(name));
                    l_map.insert("IndexName".to_string(), json!(name));
                }
                let schema = l.key_schema();
                if !schema.is_empty() {
                    let schema_json: Vec<Value> = schema
                        .iter()
                        .map(|k| {
                            json!({
                                "attributeName": k.attribute_name(),
                                "AttributeName": k.attribute_name(),
                                "keyType": k.key_type().as_str(),
                                "KeyType": k.key_type().as_str(),
                            })
                        })
                        .collect();
                    l_map.insert("keySchema".to_string(), Value::Array(schema_json.clone()));
                    l_map.insert("KeySchema".to_string(), Value::Array(schema_json));
                }
                if let Some(proj) = l.projection() {
                    let mut p_map = serde_json::Map::new();
                    if let Some(pt) = proj.projection_type() {
                        p_map.insert("projectionType".to_string(), json!(pt.as_str()));
                        p_map.insert("ProjectionType".to_string(), json!(pt.as_str()));
                    }
                    let non_key = proj.non_key_attributes();
                    if !non_key.is_empty() {
                        p_map.insert("nonKeyAttributes".to_string(), json!(non_key));
                        p_map.insert("NonKeyAttributes".to_string(), json!(non_key));
                    }
                    l_map.insert("projection".to_string(), Value::Object(p_map.clone()));
                    l_map.insert("Projection".to_string(), Value::Object(p_map));
                }
                Value::Object(l_map)
            })
            .collect();
        map.insert("localSecondaryIndexes".to_string(), Value::Array(lsi_json.clone()));
        map.insert("LocalSecondaryIndexes".to_string(), Value::Array(lsi_json));
    }

    if let Some(dt) = td.creation_date_time() {
        map.insert("creationDateTime".to_string(), json!(dt.to_string()));
        map.insert("CreationDateTime".to_string(), json!(dt.to_string()));
    }

    Value::Object(map)
}

fn parse_create_table_input(
    client: &aws_sdk_dynamodb::Client,
    params: Value,
) -> Result<aws_sdk_dynamodb::operation::create_table::builders::CreateTableFluentBuilder, String> {
    let table_name = params
        .get("TableName")
        .or_else(|| params.get("tableName"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| "TableName is required".to_string())?;

    let mut req = client.create_table().table_name(table_name);

    if let Some(attrs) = params
        .get("AttributeDefinitions")
        .or_else(|| params.get("attributeDefinitions"))
        .and_then(|v| v.as_array())
    {
        for attr in attrs {
            let name = attr
                .get("AttributeName")
                .or_else(|| attr.get("attributeName"))
                .and_then(|v| v.as_str())
                .ok_or_else(|| "AttributeName is missing".to_string())?;
            let typ = attr
                .get("AttributeType")
                .or_else(|| attr.get("attributeType"))
                .and_then(|v| v.as_str())
                .ok_or_else(|| "AttributeType is missing".to_string())?;
            let t = match typ.to_uppercase().as_str() {
                "S" => ScalarAttributeType::S,
                "N" => ScalarAttributeType::N,
                "B" => ScalarAttributeType::B,
                _ => return Err(format!("Unsupported AttributeType: {}", typ)),
            };
            req = req.attribute_definitions(
                AttributeDefinition::builder()
                    .attribute_name(name)
                    .attribute_type(t)
                    .build()
                    .map_err(|e| format!("Failed to build AttributeDefinition: {}", e))?,
            );
        }
    } else {
        return Err("AttributeDefinitions array is required".to_string());
    }

    if let Some(schema) = params
        .get("KeySchema")
        .or_else(|| params.get("keySchema"))
        .and_then(|v| v.as_array())
    {
        for key in schema {
            let name = key
                .get("AttributeName")
                .or_else(|| key.get("attributeName"))
                .and_then(|v| v.as_str())
                .ok_or_else(|| "KeySchema AttributeName missing".to_string())?;
            let typ = key
                .get("KeyType")
                .or_else(|| key.get("keyType"))
                .and_then(|v| v.as_str())
                .ok_or_else(|| "KeySchema KeyType missing".to_string())?;
            let t = match typ.to_uppercase().as_str() {
                "HASH" => KeyType::Hash,
                "RANGE" => KeyType::Range,
                _ => return Err(format!("Unknown KeyType: {}", typ)),
            };
            req = req.key_schema(
                KeySchemaElement::builder()
                    .attribute_name(name)
                    .key_type(t)
                    .build()
                    .map_err(|e| format!("Failed to build KeySchemaElement: {}", e))?,
            );
        }
    } else {
        return Err("KeySchema array is required".to_string());
    }

    let billing_mode_str = params
        .get("BillingMode")
        .or_else(|| params.get("billingMode"))
        .and_then(|v| v.as_str())
        .unwrap_or("PAY_PER_REQUEST");

    let is_on_demand = billing_mode_str.eq_ignore_ascii_case("PAY_PER_REQUEST");

    if is_on_demand {
        req = req.billing_mode(BillingMode::PayPerRequest);
    } else {
        req = req.billing_mode(BillingMode::Provisioned);
        let pt = params
            .get("ProvisionedThroughput")
            .or_else(|| params.get("provisionedThroughput"));
        let read = pt
            .and_then(|p| p.get("ReadCapacityUnits").or_else(|| p.get("readCapacityUnits")))
            .and_then(|v| v.as_i64())
            .unwrap_or(5);
        let write = pt
            .and_then(|p| p.get("WriteCapacityUnits").or_else(|| p.get("writeCapacityUnits")))
            .and_then(|v| v.as_i64())
            .unwrap_or(5);

        req = req.provisioned_throughput(
            ProvisionedThroughput::builder()
                .read_capacity_units(read)
                .write_capacity_units(write)
                .build()
                .map_err(|e| format!("Failed to build ProvisionedThroughput: {}", e))?,
        );
    }

    if let Some(gsi_list) = params
        .get("GlobalSecondaryIndexes")
        .or_else(|| params.get("globalSecondaryIndexes"))
        .and_then(|v| v.as_array())
    {
        for gsi in gsi_list {
            let mut builder = GlobalSecondaryIndex::builder();
            if let Some(name) = gsi
                .get("IndexName")
                .or_else(|| gsi.get("indexName"))
                .and_then(|v| v.as_str())
            {
                builder = builder.index_name(name);
            }
            if let Some(schema) = gsi
                .get("KeySchema")
                .or_else(|| gsi.get("keySchema"))
                .and_then(|v| v.as_array())
            {
                for key in schema {
                    let name = key
                        .get("AttributeName")
                        .or_else(|| key.get("attributeName"))
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| "GSI KeySchema AttributeName missing".to_string())?;
                    let typ = key
                        .get("KeyType")
                        .or_else(|| key.get("keyType"))
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| "GSI KeySchema KeyType missing".to_string())?;
                    let t = match typ.to_uppercase().as_str() {
                        "HASH" => KeyType::Hash,
                        "RANGE" => KeyType::Range,
                        _ => return Err(format!("Unknown KeyType: {}", typ)),
                    };
                    builder = builder.key_schema(
                        KeySchemaElement::builder()
                            .attribute_name(name)
                            .key_type(t)
                            .build()
                            .map_err(|e| format!("Failed to build GSI KeySchemaElement: {}", e))?,
                    );
                }
            }
            if let Some(proj) = gsi.get("Projection").or_else(|| gsi.get("projection")) {
                let mut p_builder = Projection::builder();
                if let Some(pt) = proj
                    .get("ProjectionType")
                    .or_else(|| proj.get("projectionType"))
                    .and_then(|v| v.as_str())
                {
                    let p = match pt.to_uppercase().as_str() {
                        "ALL" => ProjectionType::All,
                        "KEYS_ONLY" => ProjectionType::KeysOnly,
                        "INCLUDE" => ProjectionType::Include,
                        _ => return Err(format!("Unknown ProjectionType: {}", pt)),
                    };
                    p_builder = p_builder.projection_type(p);
                }
                if let Some(non_key) = proj
                    .get("NonKeyAttributes")
                    .or_else(|| proj.get("nonKeyAttributes"))
                    .and_then(|v| v.as_array())
                {
                    for nk in non_key {
                        if let Some(s) = nk.as_str() {
                            p_builder = p_builder.non_key_attributes(s);
                        }
                    }
                }
                builder = builder.projection(p_builder.build());
            }
            if !is_on_demand {
                if let Some(pt) = gsi
                    .get("ProvisionedThroughput")
                    .or_else(|| gsi.get("provisionedThroughput"))
                {
                    let read = pt
                        .get("ReadCapacityUnits")
                        .or_else(|| pt.get("readCapacityUnits"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(5);
                    let write = pt
                        .get("WriteCapacityUnits")
                        .or_else(|| pt.get("writeCapacityUnits"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(5);
                    builder = builder.provisioned_throughput(
                        ProvisionedThroughput::builder()
                            .read_capacity_units(read)
                            .write_capacity_units(write)
                            .build()
                            .map_err(|e| format!("Failed to build GSI ProvisionedThroughput: {}", e))?,
                    );
                }
            }
            req = req.global_secondary_indexes(
                builder
                    .build()
                    .map_err(|e| format!("Failed to build GlobalSecondaryIndex: {}", e))?,
            );
        }
    }

    if let Some(lsi_list) = params
        .get("LocalSecondaryIndexes")
        .or_else(|| params.get("localSecondaryIndexes"))
        .and_then(|v| v.as_array())
    {
        for lsi in lsi_list {
            let mut builder = LocalSecondaryIndex::builder();
            if let Some(name) = lsi
                .get("IndexName")
                .or_else(|| lsi.get("indexName"))
                .and_then(|v| v.as_str())
            {
                builder = builder.index_name(name);
            }
            if let Some(schema) = lsi
                .get("KeySchema")
                .or_else(|| lsi.get("keySchema"))
                .and_then(|v| v.as_array())
            {
                for key in schema {
                    let name = key
                        .get("AttributeName")
                        .or_else(|| key.get("attributeName"))
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| "LSI KeySchema AttributeName missing".to_string())?;
                    let typ = key
                        .get("KeyType")
                        .or_else(|| key.get("keyType"))
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| "LSI KeySchema KeyType missing".to_string())?;
                    let t = match typ.to_uppercase().as_str() {
                        "HASH" => KeyType::Hash,
                        "RANGE" => KeyType::Range,
                        _ => return Err(format!("Unknown KeyType: {}", typ)),
                    };
                    builder = builder.key_schema(
                        KeySchemaElement::builder()
                            .attribute_name(name)
                            .key_type(t)
                            .build()
                            .map_err(|e| format!("Failed to build LSI KeySchemaElement: {}", e))?,
                    );
                }
            }
            if let Some(proj) = lsi.get("Projection").or_else(|| lsi.get("projection")) {
                let mut p_builder = Projection::builder();
                if let Some(pt) = proj
                    .get("ProjectionType")
                    .or_else(|| proj.get("projectionType"))
                    .and_then(|v| v.as_str())
                {
                    let p = match pt.to_uppercase().as_str() {
                        "ALL" => ProjectionType::All,
                        "KEYS_ONLY" => ProjectionType::KeysOnly,
                        "INCLUDE" => ProjectionType::Include,
                        _ => return Err(format!("Unknown ProjectionType: {}", pt)),
                    };
                    p_builder = p_builder.projection_type(p);
                }
                if let Some(non_key) = proj
                    .get("NonKeyAttributes")
                    .or_else(|| proj.get("nonKeyAttributes"))
                    .and_then(|v| v.as_array())
                {
                    for nk in non_key {
                        if let Some(s) = nk.as_str() {
                            p_builder = p_builder.non_key_attributes(s);
                        }
                    }
                }
                builder = builder.projection(p_builder.build());
            }
            req = req.local_secondary_indexes(
                builder
                    .build()
                    .map_err(|e| format!("Failed to build LocalSecondaryIndex: {}", e))?,
            );
        }
    }

    Ok(req)
}

#[tauri::command]
pub async fn tables_list(
    state: State<'_, AwsClientState>,
    app: AppHandle,
) -> Result<Value, String> {
    let client = get_dynamodb_client(&state, &app).await?;

    let mut table_names = Vec::new();
    let mut last_evaluated_table_name = None;

    loop {
        let mut request = client.list_tables();
        if let Some(name) = last_evaluated_table_name {
            request = request.exclusive_start_table_name(name);
        }

        match request.send().await {
            Ok(res) => {
                let names = res.table_names();
                if !names.is_empty() {
                    table_names.extend(names.iter().map(|s| s.to_string()));
                }
                last_evaluated_table_name = res.last_evaluated_table_name().map(|s| s.to_string());
                if last_evaluated_table_name.is_none() {
                    break;
                }
            }
            Err(e) => {
                return Err(sanitize_error_message(e));
            }
        }
    }

    Ok(json!({
        "success": true,
        "tableNames": table_names
    }))
}

#[tauri::command]
pub async fn tables_describe(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    table_name: String,
) -> Result<Value, String> {
    let client = get_dynamodb_client(&state, &app).await?;

    match client.describe_table().table_name(table_name).send().await {
        Ok(res) => {
            let table = res.table().map(map_table_description).unwrap_or(Value::Null);
            Ok(json!({
                "success": true,
                "table": table
            }))
        }
        Err(e) => Err(sanitize_error_message(e)),
    }
}

#[tauri::command]
pub async fn tables_create(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    params: Value,
) -> Result<Value, String> {
    let client = get_dynamodb_client(&state, &app).await?;

    let req = parse_create_table_input(&client, params)?;

    match req.send().await {
        Ok(res) => {
            let table = res.table_description().map(map_table_description).unwrap_or(Value::Null);
            Ok(json!({
                "success": true,
                "table": table
            }))
        }
        Err(e) => Err(sanitize_error_message(e)),
    }
}

#[tauri::command]
pub async fn tables_delete(
    state: State<'_, AwsClientState>,
    app: AppHandle,
    table_name: String,
) -> Result<Value, String> {
    let client = get_dynamodb_client(&state, &app).await?;

    match client.delete_table().table_name(table_name).send().await {
        Ok(_) => Ok(json!({
            "success": true
        })),
        Err(e) => Err(sanitize_error_message(e)),
    }
}
