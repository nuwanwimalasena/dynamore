# Security Test Instructions

## Purpose
Verify compliance with Security Baseline rules (`SECURITY-01`, `03`, `05`, `09`, `14`, `15`).

---

## Security Verification Checklist

- [x] **TLS 1.2+ Transit Encryption (SECURITY-01)**: Verified all AWS Rust SDK calls route through default HTTPS/TLS configurations.
- [x] **Zero Credential Leakage in Errors & Logs (SECURITY-03, SECURITY-14)**: Verified that session tokens and secret access keys are excluded from IPC responses and error strings via `sanitize_error_message`.
- [x] **Input Validation & Parameter Sanitization (SECURITY-05)**: Verified table names, key schemas, and attribute definitions reject malformed inputs before calling AWS endpoints.
- [x] **Token Trimming & Normalization**: Verified empty string session tokens are normalized to `None` to prevent `InvalidClientTokenId` header errors.
