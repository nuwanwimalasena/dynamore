# Unit Test Execution Instructions

## Run Unit Tests

### 1. Execute Frontend Compilation & Type Verification
```bash
npx tsc --noEmit
```
- **Expected**: 0 type errors.

### 2. Execute Backend Rust Checks
```bash
cd src-tauri
cargo check --tests
cd ..
```
- **Expected**: Finished `dev` profile with 0 compilation errors.

### 3. Review Test Results
- **TypeScript Verification**: All IPC payload structures in `src/api.ts` align with component state signatures.
- **Rust Type Safety**: All 12+ `#[tauri::command]` handlers adhere to the `Result<T, String>` return convention with `AwsClientState` dependency injection.
