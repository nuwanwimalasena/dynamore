use tauri::AppHandle;
use serde_json::{json, Value};
use aws_sdk_dynamodb::types::{
    AttributeDefinition, KeySchemaElement, KeyType, ProvisionedThroughput, ScalarAttributeType,
    GlobalSecondaryIndex, LocalSecondaryIndex, Projection, ProjectionType, BillingMode,
    TableDescription,
};

fn map_table_description(td: &TableDescription) -> Value {
    let mut map = serde_json::Map::new();

    if let Some(name) = td.table_name() {
        map.insert("TableName".to_string(), json!(name));
    }
    if let Some(status) = td.table_status() {
        map.insert("TableStatus".to_string(), json!(status.as_str()));
    }
    if let Some(count) = td.item_count() {
        map.insert("ItemCount".to_string(), json!(count));
    }
    if let Some(size) = td.table_size_bytes() {
        map.insert("TableSizeBytes".to_string(), json!(size));
    }

    if let Some(billing) = td.billing_mode_summary() {
        if let Some(mode) = billing.billing_mode() {
            map.insert("BillingModeSummary".to_string(), json!({
                "BillingMode": mode.as_str()
            }));
        }
    }

    if let Some(pt) = td.provisioned_throughput() {
        let mut pt_map = serde_json::Map::new();
        if let Some(read) = pt.read_capacity_units() {
            pt_map.insert("ReadCapacityUnits".to_string(), json!(read));
        }
        if let Some(write) = pt.write_capacity_units() {
            pt_map.insert("WriteCapacityUnits".to_string(), json!(write));
        }
        map.insert("ProvisionedThroughput".to_string(), Value::Object(pt_map));
    }

    let schema = td.key_schema();
    if !schema.is_empty() {
        let schema_json: Vec<Value> = schema.iter().map(|k| {
            json!({
                "AttributeName": k.attribute_name(),
                "KeyType": k.key_type().as_str(),
            })
        }).collect();
        map.insert("KeySchema".to_string(), Value::Array(schema_json));
    }

    let attrs = td.attribute_definitions();
    if !attrs.is_empty() {
        let attrs_json: Vec<Value> = attrs.iter().map(|a| {
            json!({
                "AttributeName": a.attribute_name(),
                "AttributeType": a.attribute_type().as_str(),
            })
        }).collect();
        map.insert("AttributeDefinitions".to_string(), Value::Array(attrs_json));
    }

    let gsi = td.global_secondary_indexes();
    if !gsi.is_empty() {
        let gsi_json: Vec<Value> = gsi.iter().map(|g| {
            let mut g_map = serde_json::Map::new();
            if let Some(name) = g.index_name() {
                g_map.insert("IndexName".to_string(), json!(name));
            }
            if let Some(status) = g.index_status() {
                g_map.insert("IndexStatus".to_string(), json!(status.as_str()));
            }
            let schema = g.key_schema();
            if !schema.is_empty() {
                let schema_json: Vec<Value> = schema.iter().map(|k| {
                    json!({
                        "AttributeName": k.attribute_name(),
                        "KeyType": k.key_type().as_str(),
                    })
                }).collect();
                g_map.insert("KeySchema".to_string(), Value::Array(schema_json));
            }
            if let Some(proj) = g.projection() {
                let mut p_map = serde_json::Map::new();
                if let Some(pt) = proj.projection_type() {
                    p_map.insert("ProjectionType".to_string(), json!(pt.as_str()));
                }
                let non_key = proj.non_key_attributes();
                if !non_key.is_empty() {
                    p_map.insert("NonKeyAttributes".to_string(), json!(non_key));
                }
                g_map.insert("Projection".to_string(), Value::Object(p_map));
            }
            if let Some(pt) = g.provisioned_throughput() {
                let mut pt_map = serde_json::Map::new();
                if let Some(read) = pt.read_capacity_units() {
                    pt_map.insert("ReadCapacityUnits".to_string(), json!(read));
                }
                if let Some(write) = pt.write_capacity_units() {
                    pt_map.insert("WriteCapacityUnits".to_string(), json!(write));
                }
                g_map.insert("ProvisionedThroughput".to_string(), Value::Object(pt_map));
            }
            Value::Object(g_map)
        }).collect();
        map.insert("GlobalSecondaryIndexes".to_string(), Value::Array(gsi_json));
    }

    let lsi = td.local_secondary_indexes();
    if !lsi.is_empty() {
        let lsi_json: Vec<Value> = lsi.iter().map(|l| {
            let mut l_map = serde_json::Map::new();
            if let Some(name) = l.index_name() {
                l_map.insert("IndexName".to_string(), json!(name));
            }
            let schema = l.key_schema();
            if !schema.is_empty() {
                let schema_json: Vec<Value> = schema.iter().map(|k| {
                    json!({
                        "AttributeName": k.attribute_name(),
                        "KeyType": k.key_type().as_str(),
                    })
                }).collect();
                l_map.insert("KeySchema".to_string(), Value::Array(schema_json));
            }
            if let Some(proj) = l.projection() {
                let mut p_map = serde_json::Map::new();
                if let Some(pt) = proj.projection_type() {
                    p_map.insert("ProjectionType".to_string(), json!(pt.as_str()));
                }
                let non_key = proj.non_key_attributes();
                if !non_key.is_empty() {
                    p_map.insert("NonKeyAttributes".to_string(), json!(non_key));
                }
                l_map.insert("Projection".to_string(), Value::Object(p_map));
            }
            Value::Object(l_map)
        }).collect();
        map.insert("LocalSecondaryIndexes".to_string(), Value::Array(lsi_json));
    }

    if let Some(dt) = td.creation_date_time() {
        map.insert("CreationDateTime".to_string(), json!(dt.to_string()));
    }

    Value::Object(map)
}

fn parse_create_table_input(
    client: &aws_sdk_dynamodb::Client,
    params: Value
) -> Result<aws_sdk_dynamodb::operation::create_table::builders::CreateTableFluentBuilder, String> {
    let mut req = client.create_table();

    if let Some(table_name) = params.get("TableName").and_then(|v| v.as_str()) {
        req = req.table_name(table_name);
    } else {
        return Err("TableName is required".to_string());
    }

    if let Some(attrs) = params.get("AttributeDefinitions").and_then(|v| v.as_array()) {
        for attr in attrs {
            let name = attr.get("AttributeName").and_then(|v| v.as_str()).ok_or("AttributeName missing")?;
            let typ = attr.get("AttributeType").and_then(|v| v.as_str()).ok_or("AttributeType missing")?;
            let t = match typ {
                "S" => ScalarAttributeType::S,
                "N" => ScalarAttributeType::N,
                "B" => ScalarAttributeType::B,
                _ => return Err(format!("Unknown AttributeType {}", typ)),
            };
            req = req.attribute_definitions(
                AttributeDefinition::builder().attribute_name(name).attribute_type(t).build().map_err(|e| e.to_string())?
            );
        }
    }

    if let Some(schema) = params.get("KeySchema").and_then(|v| v.as_array()) {
        for key in schema {
            let name = key.get("AttributeName").and_then(|v| v.as_str()).ok_or("AttributeName missing")?;
            let typ = key.get("KeyType").and_then(|v| v.as_str()).ok_or("KeyType missing")?;
            let t = match typ {
                "HASH" => KeyType::Hash,
                "RANGE" => KeyType::Range,
                _ => return Err(format!("Unknown KeyType {}", typ)),
            };
            req = req.key_schema(
                KeySchemaElement::builder().attribute_name(name).key_type(t).build().map_err(|e| e.to_string())?
            );
        }
    }

    if let Some(mode) = params.get("BillingMode").and_then(|v| v.as_str()) {
        let m = match mode {
            "PROVISIONED" => BillingMode::Provisioned,
            "PAY_PER_REQUEST" => BillingMode::PayPerRequest,
            _ => return Err(format!("Unknown BillingMode {}", mode)),
        };
        req = req.billing_mode(m);
    }

    if let Some(pt) = params.get("ProvisionedThroughput") {
        let read = pt.get("ReadCapacityUnits").and_then(|v| v.as_i64()).unwrap_or(0);
        let write = pt.get("WriteCapacityUnits").and_then(|v| v.as_i64()).unwrap_or(0);
        req = req.provisioned_throughput(
            ProvisionedThroughput::builder()
                .read_capacity_units(read)
                .write_capacity_units(write)
                .build().map_err(|e| e.to_string())?
        );
    }

    if let Some(gsi_list) = params.get("GlobalSecondaryIndexes").and_then(|v| v.as_array()) {
        for gsi in gsi_list {
            let mut builder = GlobalSecondaryIndex::builder();
            if let Some(name) = gsi.get("IndexName").and_then(|v| v.as_str()) {
                builder = builder.index_name(name);
            }
            if let Some(schema) = gsi.get("KeySchema").and_then(|v| v.as_array()) {
                for key in schema {
                    let name = key.get("AttributeName").and_then(|v| v.as_str()).ok_or("AttributeName missing")?;
                    let typ = key.get("KeyType").and_then(|v| v.as_str()).ok_or("KeyType missing")?;
                    let t = match typ {
                        "HASH" => KeyType::Hash,
                        "RANGE" => KeyType::Range,
                        _ => return Err(format!("Unknown KeyType {}", typ)),
                    };
                    builder = builder.key_schema(
                        KeySchemaElement::builder().attribute_name(name).key_type(t).build().map_err(|e| e.to_string())?
                    );
                }
            }
            if let Some(proj) = gsi.get("Projection") {
                let mut p_builder = Projection::builder();
                if let Some(pt) = proj.get("ProjectionType").and_then(|v| v.as_str()) {
                    let p = match pt {
                        "ALL" => ProjectionType::All,
                        "KEYS_ONLY" => ProjectionType::KeysOnly,
                        "INCLUDE" => ProjectionType::Include,
                        _ => return Err(format!("Unknown ProjectionType {}", pt)),
                    };
                    p_builder = p_builder.projection_type(p);
                }
                if let Some(non_key) = proj.get("NonKeyAttributes").and_then(|v| v.as_array()) {
                    for nk in non_key {
                        if let Some(s) = nk.as_str() {
                            p_builder = p_builder.non_key_attributes(s);
                        }
                    }
                }
                builder = builder.projection(p_builder.build());
            }
            if let Some(pt) = gsi.get("ProvisionedThroughput") {
                let read = pt.get("ReadCapacityUnits").and_then(|v| v.as_i64()).unwrap_or(0);
                let write = pt.get("WriteCapacityUnits").and_then(|v| v.as_i64()).unwrap_or(0);
                builder = builder.provisioned_throughput(
                    ProvisionedThroughput::builder()
                        .read_capacity_units(read)
                        .write_capacity_units(write)
                        .build().map_err(|e| e.to_string())?
                );
            }
            req = req.global_secondary_indexes(builder.build().map_err(|e| e.to_string())?);
        }
    }

    if let Some(lsi_list) = params.get("LocalSecondaryIndexes").and_then(|v| v.as_array()) {
        for lsi in lsi_list {
            let mut builder = LocalSecondaryIndex::builder();
            if let Some(name) = lsi.get("IndexName").and_then(|v| v.as_str()) {
                builder = builder.index_name(name);
            }
            if let Some(schema) = lsi.get("KeySchema").and_then(|v| v.as_array()) {
                for key in schema {
                    let name = key.get("AttributeName").and_then(|v| v.as_str()).ok_or("AttributeName missing")?;
                    let typ = key.get("KeyType").and_then(|v| v.as_str()).ok_or("KeyType missing")?;
                    let t = match typ {
                        "HASH" => KeyType::Hash,
                        "RANGE" => KeyType::Range,
                        _ => return Err(format!("Unknown KeyType {}", typ)),
                    };
                    builder = builder.key_schema(
                        KeySchemaElement::builder().attribute_name(name).key_type(t).build().map_err(|e| e.to_string())?
                    );
                }
            }
            if let Some(proj) = lsi.get("Projection") {
                let mut p_builder = Projection::builder();
                if let Some(pt) = proj.get("ProjectionType").and_then(|v| v.as_str()) {
                    let p = match pt {
                        "ALL" => ProjectionType::All,
                        "KEYS_ONLY" => ProjectionType::KeysOnly,
                        "INCLUDE" => ProjectionType::Include,
                        _ => return Err(format!("Unknown ProjectionType {}", pt)),
                    };
                    p_builder = p_builder.projection_type(p);
                }
                if let Some(non_key) = proj.get("NonKeyAttributes").and_then(|v| v.as_array()) {
                    for nk in non_key {
                        if let Some(s) = nk.as_str() {
                            p_builder = p_builder.non_key_attributes(s);
                        }
                    }
                }
                builder = builder.projection(p_builder.build());
            }
            req = req.local_secondary_indexes(builder.build().map_err(|e| e.to_string())?);
        }
    }

    Ok(req)
}

#[tauri::command]
pub async fn tables_list(app: AppHandle) -> Result<Value, String> {
    let client = crate::aws_client::get_dynamodb_client(app.clone()).await.map_err(|e| e.to_string())?;

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
                return Ok(json!({
                    "success": false,
                    "error": e.to_string()
                }));
            }
        }
    }

    Ok(json!({
        "success": true,
        "tableNames": table_names
    }))
}

#[tauri::command]
pub async fn tables_describe(app: AppHandle, table_name: String) -> Result<Value, String> {
    let client = crate::aws_client::get_dynamodb_client(app.clone()).await.map_err(|e| e.to_string())?;
    
    match client.describe_table().table_name(table_name).send().await {
        Ok(res) => {
            let table = res.table().map(map_table_description).unwrap_or(Value::Null);
            Ok(json!({
                "success": true,
                "table": table
            }))
        }
        Err(e) => {
            Ok(json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
pub async fn tables_create(app: AppHandle, params: Value) -> Result<Value, String> {
    let client = crate::aws_client::get_dynamodb_client(app.clone()).await.map_err(|e| e.to_string())?;

    let req = match parse_create_table_input(&client, params) {
        Ok(r) => r,
        Err(e) => return Ok(json!({ "success": false, "error": e })),
    };

    match req.send().await {
        Ok(res) => {
            let table = res.table_description().map(map_table_description).unwrap_or(Value::Null);
            Ok(json!({
                "success": true,
                "table": table
            }))
        }
        Err(e) => {
            Ok(json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
pub async fn tables_delete(app: AppHandle, table_name: String) -> Result<Value, String> {
    let client = crate::aws_client::get_dynamodb_client(app.clone()).await.map_err(|e| e.to_string())?;

    match client.delete_table().table_name(table_name).send().await {
        Ok(_) => {
            Ok(json!({
                "success": true
            }))
        }
        Err(e) => {
            Ok(json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}
