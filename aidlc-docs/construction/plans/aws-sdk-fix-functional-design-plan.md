# Functional Design Plan: Unit `aws-sdk-fix`

## Purpose
Design the detailed data models, business logic algorithms, validation rules, error handling structures, and frontend contracts for overhauling and fixing all AWS SDK operations across Dynamore.

## Plan Steps
- [x] Step 1: Design Domain Entities & Data Structures (`domain-entities.md`)
  - Define `AwsClientState` managed cache structure for Tauri state.
  - Define unified `Result<T, String>` response envelopes and error types.
  - Define query/scan accumulation structures, table models, and item CRUD payloads.
- [x] Step 2: Design Business Logic & Core Algorithms (`business-logic-model.md`)
  - Design AWS client resolution and caching lifecycle algorithm.
  - Design Query and Scan multi-page evaluation accumulation algorithm.
  - Design DynamoDB `AttributeValue` recursive marshaling and sanitization algorithms.
  - Design Batch deletion chunking and verification algorithm.
- [x] Step 3: Formalize Business Rules & Validation Logic (`business-rules.md`)
  - Rules for input sanitization, empty string stripping, type conversions, and limits.
  - Rules for error propagation, status code mapping, and fallback behavior.
  - Rules for session expiration and re-authentication handling.
- [x] Step 4: Define Frontend Component Integration & Contracts (`frontend-components.md`)
  - Update `src/api.ts` method signatures and error trapping.
  - Detail UI error handling and notification flows across `TableDetailPage`, `QueryBuilder`, `ScanBuilder`, `ItemEditor`, `CreateTableWizard`, and `LoginPage`.
