# Functional Requirements: Login Bug Fixes

## Problem Statement
Users face login failures under two scenarios:
1. **Access Keys Login Failure**: When signing in with Access Key ID & Secret Access Key without providing a Session Token, `form.getFieldsValue()` returns `{ sessionToken: "" }`. Rust `auth_login_with_keys` receives `Some("")` and attaches an empty `session_token` to AWS STS SDK credentials, triggering AWS STS authentication error `InvalidClientTokenId`.
2. **Browser Execution & IPC Failure**: When running the app locally via `npm run dev` in a web browser without Tauri desktop runtime, `invoke()` throws `__TAURI_INTERNALS__ is not defined`. Missing promise `.catch()` in `App.tsx` and `api.ts` causes unhandled exceptions.

---

## Required Fixes

1. **Sanitize `sessionToken` in `LoginPage.tsx` & Rust `auth.rs`**:
   - In `LoginPage.tsx`: Clean form values before passing to `loginWithKeys`:
     ```ts
     const cleanValues = {
       ...values,
       sessionToken: values.sessionToken?.trim() || undefined
     }
     ```
   - In `src-tauri/src/commands/auth.rs`: Ensure `session_token` maps empty strings to `None`:
     ```rust
     let session_token = session_token.filter(|s| !s.trim().is_empty());
     ```

2. **Web / Browser Fallback & Safe IPC Wrapper in `src/api.ts`**:
   - Implement `safeInvoke` wrapper around `@tauri-apps/api/core` `invoke`:
     ```ts
     const isTauriAvailable = () => typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI_IPC__' in window);
     ```
   - In web mode when Tauri is unavailable, return structured mock/demo web fallback responses or friendly error messages instead of throwing uncaught exceptions.

3. **Graceful Error Handling in `App.tsx`**:
   - Add `.catch(() => setSession(null))` to `window.api.auth.getSession()` on app mount.
