# Requirements Document: Remember Last Selected Region

## 1. Executive Summary
Dynamore supports 29 AWS regions with dynamic post-login switching directly from the application header navbar. Currently, when an active session switches regions or when a session is re-established, the user's last selected region must be reliably tracked, persisted, and restored across app restarts and future sessions without reverting unexpectedly to defaults.

This document details the functional and non-functional requirements to make the application remember the last selected region across sessions and restarts using Tauri's native persistent storage (`dynamore-config`).

---

## 2. Requirements & Intent Analysis

### 2.1 Context & Scope
- **Domain**: Region preference persistence & session continuity.
- **Affected Subsystems**:
  - Rust Backend: `src-tauri/src/commands/auth.rs` (Tauri store interactions with `dynamore-config` & `dynamore-auth`).
  - IPC API Bridge: `src/api.ts` & `src/types/global.d.ts` (retrieval / persistence hooks if necessary).
  - Main Layout Header: `src/pages/MainLayout.tsx` (switched region handler).
  - Login Page: `src/pages/LoginPage.tsx` (initial login region selection & SSO config loading).
- **Complexity**: Low-to-Moderate (focused, high-impact user experience refinement).

---

## 3. Functional Requirements

### FR-01: Persistent Region Storage
- The application MUST store the last selected AWS region in Tauri's native `dynamore-config` store under the key `lastSelectedRegion` (in addition to updating existing session/SSO config objects).
- Storage MUST occur whenever:
  1. The user explicitly selects/switches a region from the top header dropdown in `MainLayout.tsx` (`auth_switch_region`).
  2. The user successfully logs in via AWS SSO (`auth_complete_sso_login`).
  3. The user successfully logs in via IAM Access Keys (`auth_login_with_keys`).

### FR-02: Region Retrieval on Login & Session Initialization
- On application startup or when navigating to the Login screen:
  - If a remembered region exists in `dynamore-config`, the Login forms (both SSO region config and Access Keys initial region) MUST default to this remembered region instead of hardcoding `us-east-1`.
  - If no remembered region exists, fall back to `DEFAULT_AWS_REGION` (`us-east-1`).
- When a stored session is restored upon application startup (`auth_get_session`), the session's active region MUST match the last selected/switched region.

### FR-03: Preservation Across Logout & Form Reset
- When a user logs out (`auth_logout`), the remembered region preference MUST be preserved in `dynamore-config`.
- When a user clicks "Reset" on the SSO login form, credentials, account, and role selections are cleared, but the preferred region selection remains intact unless the user explicitly alters it.

---

## 4. Non-Functional Requirements (NFR)

### NFR-01: Storage Integrity & Resiliency
- Region persistence operations MUST handle missing, empty, or corrupted store entries gracefully by falling back to `DEFAULT_AWS_REGION` (`us-east-1`).
- Stores MUST be saved/flushed properly to disk so unexpected desktop process exit does not lose recent selections.

### NFR-02: Security & Privacy
- The stored region identifier is a non-sensitive configuration string (e.g. `us-east-1`, `eu-west-1`, `ap-south-1`).
- No credentials or sensitive identity tokens may ever be written into the `lastSelectedRegion` configuration key.

### NFR-03: Backward Compatibility
- Existing user installations that already have `lastSSOConfig` without a dedicated `lastSelectedRegion` key MUST seamlessly migrate upon their next login or region switch.

---

## 5. Traceability Matrix

| Requirement ID | Module / Component | Verification Method |
| :--- | :--- | :--- |
| **FR-01** | `src-tauri/src/commands/auth.rs` | Unit Test in `auth_logic_tests.rs` & `cargo test` |
| **FR-02** | `src/pages/LoginPage.tsx`, `src-tauri` | Unit Test in `LoginPage.test.tsx` / `vitest` |
| **FR-03** | `src-tauri/src/commands/auth.rs`, `src/pages/LoginPage.tsx` | Vitest / Cargo Test verification |
| **NFR-01** | `src-tauri/src/commands/auth.rs` | Test fallback handling with invalid region input |
| **NFR-02** | `src-tauri` store serialization | Code review & store audit |
