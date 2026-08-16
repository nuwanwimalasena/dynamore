# API Documentation

## Tauri IPC API & AWS SDK Operations Mapping

### 1. Authentication APIs (`commands/auth.rs`)

#### `auth_init_sso`
- **Tauri Command**: `auth_init_sso`
- **Underlying AWS SDK Call**: `aws_sdk_ssooidc::Client::register_client()` & `aws_sdk_ssooidc::Client::start_device_authorization()`
- **Request Parameters**:
  ```json
  {
    "startUrl": "string (https://<portal>.awsapps.com/start)",
    "region": "string (e.g. us-east-1)"
  }
  ```
- **Response**:
  ```json
  {
    "clientId": "string",
    "clientSecret": "string",
    "deviceCode": "string",
    "interval": 3000,
    "expiresAt": 1723500000000,
    "startUrl": "string",
    "region": "string"
  }
  ```
- **Description**: Registers the client with SSO OIDC, requests device authorization code, and launches the default web browser to the verification URI.

#### `auth_poll_sso_token`
- **Tauri Command**: `auth_poll_sso_token`
- **Underlying AWS SDK Call**: `aws_sdk_ssooidc::Client::create_token()` in polling loop
- **Request Parameters**:
  ```json
  {
    "region": "string",
    "clientId": "string",
    "clientSecret": "string",
    "deviceCode": "string",
    "interval": 3000,
    "expiresAt": 1723500000000
  }
  ```
- **Response**:
  ```json
  {
    "accessToken": "string"
  }
  ```
- **Description**: Polls AWS SSO OIDC until the user authorizes the login in their browser, with backoff and error discrimination for pending vs terminal errors.

#### `auth_list_sso_accounts`
- **Tauri Command**: `auth_list_sso_accounts`
- **Underlying AWS SDK Call**: `aws_sdk_sso::Client::list_accounts()`
- **Request Parameters**:
  ```json
  {
    "accessToken": "string",
    "region": "string"
  }
  ```
- **Response**:
  ```json
  {
    "accounts": [
      {
        "accountId": "123456789012",
        "accountName": "Production",
        "emailAddress": "admin@example.com"
      }
    ]
  }
  ```

#### `auth_list_sso_account_roles`
- **Tauri Command**: `auth_list_sso_account_roles`
- **Underlying AWS SDK Call**: `aws_sdk_sso::Client::list_account_roles()`
- **Request Parameters**:
  ```json
  {
    "accessToken": "string",
    "region": "string",
    "accountId": "string"
  }
  ```
- **Response**:
  ```json
  {
    "roles": [
      {
        "roleName": "AdministratorAccess",
        "accountId": "123456789012"
      }
    ]
  }
  ```

#### `auth_complete_sso_login`
- **Tauri Command**: `auth_complete_sso_login`
- **Underlying AWS SDK Call**: `aws_sdk_sso::Client::get_role_credentials()`
- **Request Parameters**:
  ```json
  {
    "accessToken": "string",
    "region": "string",
    "ssoRegion": "string (optional)",
    "accountId": "string",
    "roleName": "string",
    "startUrl": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "accountId": "123456789012",
    "roleName": "AdministratorAccess",
    "region": "us-east-1"
  }
  ```
- **Description**: Retrieves temporary STS role credentials from SSO, stores session in `dynamore-auth` store, and updates recent SSO config in `dynamore-config`.

#### `auth_login_with_keys`
- **Tauri Command**: `auth_login_with_keys`
- **Underlying AWS SDK Call**: `aws_sdk_sts::Client::get_caller_identity()`
- **Request Parameters**:
  ```json
  {
    "accessKeyId": "string",
    "secretAccessKey": "string",
    "sessionToken": "string (optional)",
    "region": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "region": "us-east-1",
    "error": null
  }
  ```
- **Description**: Validates provided IAM access keys by calling STS `GetCallerIdentity`, and stores credentials in `dynamore-auth` store upon success.

#### `auth_get_session` / `auth_logout`
- **Tauri Commands**: `auth_get_session`, `auth_logout`
- **Underlying Operation**: Reads / deletes session from `dynamore-auth` store; checks expiration time against current clock.

---

### 2. Table Management APIs (`commands/tables.rs`)

#### `tables_list`
- **Tauri Command**: `tables_list`
- **Underlying AWS SDK Call**: `aws_sdk_dynamodb::Client::list_tables()` with auto-pagination loop (`ExclusiveStartTableName` / `LastEvaluatedTableName`)
- **Request Parameters**: None (`app: AppHandle`)
- **Response**:
  ```json
  {
    "success": true,
    "tableNames": ["Users", "Orders", "Products"]
  }
  ```

#### `tables_describe`
- **Tauri Command**: `tables_describe`
- **Underlying AWS SDK Call**: `aws_sdk_dynamodb::Client::describe_table()`
- **Request Parameters**:
  ```json
  {
    "tableName": "Users"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "table": {
      "TableName": "Users",
      "TableStatus": "ACTIVE",
      "ItemCount": 1420,
      "TableSizeBytes": 320480,
      "KeySchema": [
        { "AttributeName": "userId", "KeyType": "HASH" },
        { "AttributeName": "createdAt", "KeyType": "RANGE" }
      ],
      "AttributeDefinitions": [
        { "AttributeName": "userId", "AttributeType": "S" },
        { "AttributeName": "createdAt", "AttributeType": "N" }
      ],
      "BillingModeSummary": { "BillingMode": "PAY_PER_REQUEST" },
      "ProvisionedThroughput": { "ReadCapacityUnits": 0, "WriteCapacityUnits": 0 },
      "GlobalSecondaryIndexes": [],
      "LocalSecondaryIndexes": [],
      "CreationDateTime": "2026-01-15T10:00:00Z"
    }
  }
  ```

#### `tables_create`
- **Tauri Command**: `tables_create`
- **Underlying AWS SDK Call**: `aws_sdk_dynamodb::Client::create_table()`
- **Request Parameters**:
  ```json
  {
    "params": {
      "TableName": "string",
      "AttributeDefinitions": [{ "AttributeName": "string", "AttributeType": "S|N|B" }],
      "KeySchema": [{ "AttributeName": "string", "KeyType": "HASH|RANGE" }],
      "BillingMode": "PROVISIONED|PAY_PER_REQUEST",
      "ProvisionedThroughput": { "ReadCapacityUnits": 5, "WriteCapacityUnits": 5 },
      "GlobalSecondaryIndexes": [...],
      "LocalSecondaryIndexes": [...]
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "table": { "TableName": "...", "TableStatus": "CREATING" }
  }
  ```

#### `tables_delete`
- **Tauri Command**: `tables_delete`
- **Underlying AWS SDK Call**: `aws_sdk_dynamodb::Client::delete_table()`
- **Request Parameters**:
  ```json
  {
    "tableName": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true
  }
  ```

---

### 3. Item CRUD APIs (`commands/items.rs`)

#### `items_put`
- **Tauri Command**: `items_put`
- **Underlying AWS SDK Call**: `aws_sdk_dynamodb::Client::put_item()`
- **Request Parameters**:
  ```json
  {
    "tableName": "string",
    "item": { "userId": "usr_123", "name": "Jane Doe", "active": true }
  }
  ```
- **Response**:
  ```json
  { "success": true }
  ```

#### `items_get`
- **Tauri Command**: `items_get`
- **Underlying AWS SDK Call**: `aws_sdk_dynamodb::Client::get_item()`
- **Request Parameters**:
  ```json
  {
    "tableName": "string",
    "key": { "userId": "usr_123", "createdAt": 1723500000 }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "item": { "userId": "usr_123", "name": "Jane Doe", "active": true }
  }
  ```

#### `items_update`
- **Tauri Command**: `items_update`
- **Underlying AWS SDK Call**: `aws_sdk_dynamodb::Client::update_item()`
- **Request Parameters**:
  ```json
  {
    "params": {
      "TableName": "string",
      "Key": { "userId": "usr_123" },
      "UpdateExpression": "SET #n = :v",
      "ExpressionAttributeNames": { "#n": "name" },
      "ExpressionAttributeValues": { ":v": "Jane Smith" }
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "attributes": { ... }
  }
  ```

#### `items_delete`
- **Tauri Command**: `items_delete`
- **Underlying AWS SDK Call**: `aws_sdk_dynamodb::Client::delete_item()`
- **Request Parameters**:
  ```json
  {
    "tableName": "string",
    "key": { "userId": "usr_123" }
  }
  ```
- **Response**:
  ```json
  { "success": true }
  ```

#### `items_batch_delete`
- **Tauri Command**: `items_batch_delete`
- **Underlying AWS SDK Call**: `aws_sdk_dynamodb::Client::batch_write_item()` chunked in batches of 25 items
- **Request Parameters**:
  ```json
  {
    "tableName": "string",
    "keys": [{ "userId": "usr_1" }, { "userId": "usr_2" }]
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "deletedCount": 2
  }
  ```

---

### 4. Query & Scan APIs (`commands/query.rs`)

#### `query_query`
- **Tauri Command**: `query_query`
- **Underlying AWS SDK Call**: `aws_sdk_dynamodb::Client::query()`
- **Request Parameters (`QueryParams`)**:
  ```json
  {
    "params": {
      "tableName": "string",
      "indexName": "string (optional)",
      "keyConditionExpression": "string",
      "filterExpression": "string (optional)",
      "projectionExpression": "string (optional)",
      "expressionAttributeNames": { "#k": "keyName" },
      "expressionAttributeValues": { ":val": "value" },
      "limit": 50,
      "exclusiveStartKey": { "userId": "usr_123" },
      "scanIndexForward": true
    }
  }
  ```
- **Response (`QueryResult`)**:
  ```json
  {
    "success": true,
    "items": [...],
    "count": 25,
    "scannedCount": 25,
    "lastEvaluatedKey": { "userId": "usr_148" },
    "error": null
  }
  ```

#### `query_scan`
- **Tauri Command**: `query_scan`
- **Underlying AWS SDK Call**: `aws_sdk_dynamodb::Client::scan()`
- **Request Parameters (`ScanParams`)**:
  ```json
  {
    "params": {
      "tableName": "string",
      "indexName": "string (optional)",
      "filterExpression": "string (optional)",
      "projectionExpression": "string (optional)",
      "expressionAttributeNames": { "#k": "keyName" },
      "expressionAttributeValues": { ":val": "value" },
      "limit": 50,
      "exclusiveStartKey": { "userId": "usr_123" }
    }
  }
  ```
- **Response (`QueryResult`)**:
  ```json
  {
    "success": true,
    "items": [...],
    "count": 50,
    "scannedCount": 120,
    "lastEvaluatedKey": { "userId": "usr_199" },
    "error": null
  }
  ```
