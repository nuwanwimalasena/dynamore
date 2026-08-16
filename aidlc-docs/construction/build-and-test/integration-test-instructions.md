# Integration Test Instructions

## Purpose
Validate complete end-to-end integration across Tauri IPC, AWS SDK authentication, DynamoDB client caching, table management, item CRUD, query auto-pagination, and batch write retries.

---

## Test Scenarios

### Scenario 1: Authentication & Client Caching
- **Description**: Verify login with IAM access keys or AWS SSO device code flow.
- **Steps**:
  1. Launch app with `npm run tauri dev`.
  2. Input Access Key ID, Secret Key, optional Session Token, and Region (`us-east-1`).
  3. Confirm successful login and observe `dynamore-auth` session store.
  4. Perform table operations and verify subsequent calls reuse the cached `DynamoDbClient` without 200ms latency spikes.
  5. Log out and confirm cached client is purged and UI redirects to Login page.

### Scenario 2: Table Creation, Description & Deletion
- **Description**: Create an On-Demand table and a Provisioned table with GSIs.
- **Steps**:
  1. Open Table Creation Wizard.
  2. Create table `Test_OnDemand` (`PAY_PER_REQUEST`, Partition Key: `pk` (String)).
  3. Verify table appears in sidebar and metadata is rendered in Table Detail page.
  4. Delete table `Test_OnDemand` and confirm removal from list.

### Scenario 3: Item CRUD & Recursive Marshaling
- **Description**: Insert and update complex JSON item with strings, numbers, booleans, arrays, and maps.
- **Steps**:
  1. Add item with payload: `{"id": "item-101", "name": "Antigravity", "active": true, "count": 42, "tags": ["rust", "dynamodb"]}`.
  2. Verify item is stored and retrieved with exact data types.
  3. Update item attributes and confirm changes reflect in Results Grid.

### Scenario 4: Query & Scan Multi-Page Auto-Pagination with Filters
- **Description**: Verify accumulation loop executes across multiple DynamoDB pages when filter expressions are active.
- **Steps**:
  1. In a table with >100 records, apply a Filter Expression `status = :active` and set limit to `50`.
  2. Execute Query/Scan.
  3. Verify frontend returns exactly 50 matching items (or all available if <50) with accumulated scanned count and accurate `LastEvaluatedKey`.

### Scenario 5: Batch Deletion with Retries
- **Description**: Select 30+ items and execute Batch Delete.
- **Steps**:
  1. Select 30 items in the Results Grid.
  2. Click "Delete Selected".
  3. Confirm chunking splits the operation into 2 requests (25 items + 5 items) and completes with total deleted count.
