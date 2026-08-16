# Requirements Clarification Questions: AWS SDK Operations Revisit & Bug Fix

Please answer the following questions to help define the scope and technical requirements for revisiting and fixing the AWS SDK operations. Answer by filling in the letter choice after each `[Answer]:` tag.

---

## Question 1: Scope of Operational Issues Observed
Which specific AWS SDK operations or behaviors have you observed issues with?

A) Comprehensive overhaul across all modules (Tables, Item CRUD, Query/Scan, and SSO/Keys Authentication)

B) Query & Scan operations (Key condition expressions, filter expressions, pagination, and expression attribute values)

C) Item CRUD operations (PutItem, UpdateItem expressions, DeleteItem, BatchWriteItem chunking/failures)

D) Table management & schema parsing (DescribeTable attribute mapping, CreateTable types, DeleteTable)

E) Authentication & Session handling (SSO OIDC device flow, token expiry, STS credential verification)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 2: Tauri IPC Response & Error Contract Unification
Currently, command handlers use inconsistent return patterns (`Ok({ "success": false, "error": ... })` in tables vs `Err(...)` in items vs custom struct in query). What error contract should be standardized across all commands?

A) Standardized `Result<T, String>` / Native Tauri Error Propagation (Errors return `Err(message)` which rejects the frontend Promise, caught by `.catch()` or `try/catch` in TypeScript)

B) Standardized Response Envelope (`{ success: true, data: T }` or `{ success: false, error: string }` returned as `Ok` for all commands)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 3: DynamoDB AttributeValue Marshaling & Expression Value Handling
When executing Put, Update, Query, and Scan, how should attribute values and expression values be marshaled from frontend JSON?

A) Robust schema-aware marshaling with `serde_dynamo` supporting auto-pruning/sanitizing empty strings, typed numbers, booleans, maps, and lists with clear descriptive error messages

B) Raw DynamoDB AttributeValue format support (Allowing explicit `{ S: "val" }`, `{ N: "123" }` along with JSON inference)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 4: Query and Scan Pagination & Filter Handling
In DynamoDB, applying a `FilterExpression` with a `Limit` can return fewer items than `Limit` (or 0 items) along with a `LastEvaluatedKey`. How should the client handle this?

A) Auto-paging / Accumulation: Continue querying/scanning internally until the requested `Limit` is satisfied or `LastEvaluatedKey` is exhausted, returning accumulated items to the UI

B) Page-by-page with continuation token: Return whatever matching items were found in the evaluation chunk along with `LastEvaluatedKey`, allowing the UI to paginate via a "Load Next Page" button

C) Configurable: Default to page-by-page with an option in the UI to "Fetch until limit reached"

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 5: AWS SDK Client Lifecycle & Caching
`get_dynamodb_client` currently rebuilds the `aws_config` and `DynamoDbClient` on every single command call. How should client lifecycle be managed?

A) Managed Cache: Cache the active `DynamoDbClient` in Tauri managed state (`tauri::State`), invalidating/recreating it only on login, logout, or region change

B) Keep on-demand creation (recreating client per command from stored session credentials)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 6: Resiliency Baseline Extension
Should the resiliency baseline be applied to this project?

**What this extension is.** Enabling it applies a set of directional, design-time best practices for building resilient systems, derived from the AWS Well-Architected Framework (Reliability Pillar) and resilience-review guidance. It steers requirements, design, and code toward fault tolerance, high availability, observability, and recoverability.

**What this extension is NOT.** Enabling it does not make your workload production-ready, nor does it certify or guarantee any availability target. It is an informed starting point.

A) Yes — apply the resiliency baseline as directional best practices and design-time guidance (recommended for business-critical workloads)

B) No — skip the resiliency baseline (suitable for PoCs, prototypes, and experimental projects where rapid iteration matters more than reliability)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 7: Security Baseline Extension
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)

B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)

X) Other (please describe after [Answer]: tag below)

[Answer]: 
A
---

## Question 8: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, serialization, or stateful components)

B) Partial — enforce PBT rules only for pure functions and serialization round-trips (suitable for projects with limited algorithmic complexity)

C) No — skip all PBT rules (suitable for simple CRUD applications, UI-only projects, or thin integration layers with no significant business logic)

X) Other (please describe after [Answer]: tag below)

[Answer]: C
