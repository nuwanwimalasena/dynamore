# Functional Design: Remember Last Selected Region

## 1. Overview
This document specifies the technical design for persistently tracking and restoring the user's active AWS region in Dynamore.

---

## 2. Persistent Storage Contract

### Store Name
`dynamore-config` (persisted via `tauri-plugin-store`)

### Configuration Keys
- `lastSelectedRegion`: `String` (e.g. `"us-east-1"`, `"ap-southeast-1"`, `"eu-west-1"`)
- `lastSSOConfig`: Existing struct containing `{ startUrl, region, accountId, roleName }`.

When `lastSelectedRegion` is updated:
1. `auth_switch_region(region)` updates `session.region` in `dynamore-auth`, updates `lastSelectedRegion` in `dynamore-config`, and updates `lastSSOConfig.region` if it exists.
2. `auth_complete_sso_login(...)` updates `lastSelectedRegion` in `dynamore-config`.
3. `auth_login_with_keys(...)` updates `lastSelectedRegion` in `dynamore-config`.
4. `auth_get_last_region()` retrieves `lastSelectedRegion` from `dynamore-config`, with fallback to `lastSSOConfig.region` or `DEFAULT_AWS_REGION` (`"us-east-1"`).

---

## 3. IPC API Bridge Contract

### Tauri Command
```rust
#[tauri::command]
pub async fn auth_get_last_region(app: AppHandle) -> Result<Option<String>, String> {
    let store = app.store("dynamore-config").map_err(|e| e.to_string())?;
    
    // Priority 1: explicitly remembered lastSelectedRegion
    if let Some(val) = store.get("lastSelectedRegion") {
        if let Some(s) = val.as_str() {
            if !s.trim().is_empty() {
                return Ok(Some(s.trim().to_string()));
            }
        }
    }
    
    // Priority 2: fallback to lastSSOConfig region if present
    if let Some(config_val) = store.get("lastSSOConfig") {
        if let Ok(config) = serde_json::from_value::<LastSsoConfig>(config_val) {
            if !config.region.trim().is_empty() {
                return Ok(Some(config.region.trim().to_string()));
            }
        }
    }
    
    Ok(None)
}
```

### TypeScript IPC Bridge (`src/api.ts`)
```typescript
getLastRegion: () => invoke<string | null>('auth_get_last_region'),
```

### Type Definition (`src/types/global.d.ts`)
```typescript
getLastRegion: () => Promise<string | null>
```

---

## 4. Frontend Integration Workflow

### 4.1 Login Page (`src/pages/LoginPage.tsx`)
On component mount (`useEffect`):
```typescript
window.api.auth.getLastRegion().then((region) => {
    if (region) {
        form.setFieldsValue({ region })
    }
}).catch(() => {})
```
Also in the Keys login form:
Provide form instance `[keysForm] = Form.useForm()` and set `{ region }` so the region select inside the Advanced accordion pre-populates with the last chosen region.

### 4.2 Main Layout (`src/pages/MainLayout.tsx`)
When `handleRegionChange(newRegion)` is called:
`auth.switchRegion(newRegion)` is invoked. Since `auth_switch_region` writes to `dynamore-config`, subsequent app launches or re-logins will immediately read the newly switched region as their starting point.

### 4.3 Form Reset & Logout
- `auth_logout` deletes `"session"` from `dynamore-auth` but leaves `dynamore-config` intact.
- `handleReset` clears SSO form fields and config, but preserves the user's preferred region dropdown value.
