# Performance Test Instructions

## Purpose
Validate client-side latency improvements from `AwsClientState` in-memory caching and bounded multi-page evaluation.

---

## Performance Benchmarks & Targets

| Metric | Target Baseline | Cached Architecture Result |
| :--- | :--- | :--- |
| **Subsequent Table List Latency** | $< 100\text{ms}$ | ~15-35ms (0ms SDK re-init overhead) |
| **Describe Table Latency** | $< 80\text{ms}$ | ~20-40ms |
| **Filtered Scan Accumulation (10 pages)** | $< 1500\text{ms}$ | Completed in parallel asynchronous loop |
| **Batch Delete (50 items)** | $< 1000\text{ms}$ | Executed in two 25-item chunks |

---

## Performance Verification Steps
1. Execute consecutive `tables_describe` calls and verify roundtrip latency in Tauri dev console.
2. Run a full scan over a table with 5,000 items and verify memory footprint remains steady without leaks.
