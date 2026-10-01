# NFR Requirements & Compliance Assessment: Remember Last Selected Region

## 1. Security Baseline Compliance

| Rule ID | Name | Assessment / Resolution |
| :--- | :--- | :--- |
| **SECURITY-01** | Credential Leakage Prevention | PASS. `lastSelectedRegion` contains exclusively standard AWS region string identifiers (e.g., `us-east-1`). No tokens, keys, secrets, or role ARNs are saved in this key. |
| **SECURITY-02** | Input Sanitization | PASS. Region values are trimmed and checked against empty string conditions before saving. Backend defaults to `"us-east-1"` if input is blank or whitespace. |
| **SECURITY-03** | Principle of Least Privilege | PASS. Reads/writes are scoped strictly to the local application configuration store (`dynamore-config`). |

---

## 2. Resiliency Baseline Compliance

| Rule ID | Name | Assessment / Resolution |
| :--- | :--- | :--- |
| **RESILIENCY-01** | Missing Store Fallback | PASS. If `dynamore-config` or `lastSelectedRegion` does not exist or fails to open, fallback to `lastSSOConfig.region` or default `"us-east-1"` is guaranteed. No panics or unhandled errors are propagated. |
| **RESILIENCY-02** | Malformed Store Value Recovery | PASS. If `lastSelectedRegion` contains a non-string or corrupted JSON value, deserialization falls back safely to `None` / default. |
| **RESILIENCY-03** | Non-blocking Async I/O | PASS. Store reading/writing runs asynchronously in Tauri command handlers and frontend promises, preventing main thread freezing. |
