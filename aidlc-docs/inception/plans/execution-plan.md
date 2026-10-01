# Execution Plan: Remember Last Selected Region

## 1. Overview
- **Unit Name**: `remember-last-region`
- **Objective**: Persist the user's active/switched AWS region in Tauri's native `dynamore-config` store and automatically restore it across app restarts, re-logins, and session initializations.
- **Estimated Complexity**: Low-to-Moderate

---

## 2. Adaptive Stage Selection

| Phase | Stage | Planned Action | Rationale |
| :--- | :--- | :--- | :--- |
| **Inception** | Requirements Analysis | **COMPLETED** | Verified and documented in `requirements.md` |
| **Inception** | User Stories | **SKIPPED** | Focused single-feature UX improvement; requirements are unambiguous |
| **Inception** | Workflow Planning | **COMPLETED** | This document |
| **Inception** | Application Design | **SKIPPED** | Existing architecture, models, and store patterns are maintained |
| **Inception** | Units Generation | **SKIPPED** | Single unit of work: `remember-last-region` |
| **Construction** | Functional Design | **EXECUTE** | Detail IPC contracts, store keys, and fallback mechanisms |
| **Construction** | NFR Requirements | **EXECUTE** | Validate storage resiliency & security baseline compliance |
| **Construction** | NFR Design | **SKIPPED** | Existing store architecture is already proven and sufficient |
| **Construction** | Code Generation | **EXECUTE** | Implement in `src-tauri` and React frontend components |
| **Construction** | Build & Test | **EXECUTE** | Run unit tests (`cargo test` & `npm test`), build verification (`cargo check` & `npm run build`) |
| **Operations** | Operations | **SKIPPED** | Desktop local application |

---

## 3. Implementation Steps

1. **Rust Backend Commands (`src-tauri/src/commands/auth.rs`)**:
   - Update `auth_switch_region` to write `target_region` to `dynamore-config` under `"lastSelectedRegion"`.
   - Update `auth_complete_sso_login` to write `effective_region` to `dynamore-config` under `"lastSelectedRegion"`.
   - Update `auth_login_with_keys` to write `region_str` to `dynamore-config` under `"lastSelectedRegion"`.
   - Add new command `auth_get_last_region(app: AppHandle) -> Result<Option<String>, String>` or extend `auth_get_last_sso_config` / store reader.
   - Register `auth_get_last_region` in `src-tauri/src/main.rs`.
2. **IPC API Bridge (`src/api.ts` & `src/types/global.d.ts`)**:
   - Expose `window.api.auth.getLastRegion(): Promise<string | null>`.
3. **Frontend Integration**:
   - `src/pages/LoginPage.tsx`: On load, call `window.api.auth.getLastRegion()` and initialize the initial region form field for both SSO and Keys tabs.
   - `src/pages/MainLayout.tsx`: Verify region switches persist smoothly and update store/session.
4. **Verification & Tests**:
   - Add unit test in `src-tauri/tests/auth_logic_tests.rs` for region preference persistence logic.
   - Run Vitest frontend suite and verify TypeScript builds clean.
