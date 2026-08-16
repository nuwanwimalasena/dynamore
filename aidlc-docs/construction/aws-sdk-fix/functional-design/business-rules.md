# Business Rules & Validation Logic: Unit `aws-sdk-fix`

## 1. Input Sanitization & Normalization Rules

### BR-01: Session Token Sanitization
- **Rule**: If a session token is `None`, empty `""`, or contains only whitespace `"   "`, it MUST be normalized to `None`.
- **Rationale**: Passing an empty string as a session token causes AWS STS / SigV4 to transmit an empty `X-Amz-Security-Token` header, triggering `InvalidClientTokenId` on direct IAM access key requests.

### BR-02: Region Code Normalization
- **Rule**: Region identifiers MUST be trimmed of whitespace, lowercase, and validated against standard AWS region patterns (`^[a-z]{2}-[a-z]+-\\d+$` or known custom endpoints). Default fallback if empty is `us-east-1`.

### BR-03: Table Name Validation
- **Rule**: Table names MUST conform to AWS DynamoDB naming constraints (3-255 characters, letters, numbers, underscores `_`, hyphens `-`, and dots `.`).

---

## 2. Table Creation Schema Rules

### BR-04: Billing Mode & Throughput Compatibility
- **Rule**: If `BillingMode == "PAY_PER_REQUEST"` (On-Demand):
  - Do NOT specify `ProvisionedThroughput` on the base table or any Global Secondary Indexes (GSIs).
- **Rule**: If `BillingMode == "PROVISIONED"`:
  - Both `ReadCapacityUnits` and `WriteCapacityUnits` MUST be positive integers ($\ge 1$).
  - Every GSI defined in a provisioned table MUST also define explicit `ProvisionedThroughput`.

### BR-05: Attribute Definition & Key Schema Consistency
- **Rule**: Every attribute declared in `KeySchema` (Table or Index) MUST have a corresponding entry in `AttributeDefinitions` with a valid scalar type (`S`, `N`, or `B`).
- **Rule**: Attributes NOT used in primary key schemas or index key schemas MUST NOT be declared in `AttributeDefinitions` (DynamoDB rejects unreferenced attribute definitions).

---

## 3. Query & Scan Execution Rules

### BR-06: Pagination Iteration Bounds
- **Rule**: The internal accumulation loop for `query` and `scan` MUST cap at a maximum of 10 sequential page evaluations per IPC call to prevent client-side UI timeouts when scanning dense, unindexed tables with heavy filters.
- **Rule**: If the 10-page limit is reached and more data exists, the current `LastEvaluatedKey` is returned to the frontend, enabling the user to click "Load Next Page".

### BR-07: Expression Attribute Safety
- **Rule**: All reserved keyword attribute names (e.g. `status`, `year`, `order`, `date`, `type`, `count`) MUST be mapped through `ExpressionAttributeNames` using `#` prefix.
- **Rule**: All literal values in expressions MUST be mapped through `ExpressionAttributeValues` using `:` prefix.

---

## 4. Error Handling & Session Expiration Rules

### BR-08: IPC Error Propagation
- **Rule**: All errors originating from AWS SDK client operations (`ServiceError`, `DispatchError`, `SerializationError`) MUST be formatted into clean, concise string messages without raw Rust debug syntax or memory address references.
- **Rule**: Every error MUST be returned as `Err(formatted_error_string)` to trigger native Promise rejections in frontend TypeScript.

### BR-09: SSO Session Expiration Detection
- **Rule**: `auth_get_session` MUST check the expiration timestamp of SSO sessions against current system clock ($t_{exp} - 60\text{s}$). If expired, invalidate cached client and return `None`, cueing the UI to show the login modal rather than crashing on subsequent calls.
