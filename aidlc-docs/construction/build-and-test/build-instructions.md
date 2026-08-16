# Build Instructions

## Prerequisites
- **Node.js**: v18+ or v20+
- **Rust**: 1.77+ with Cargo
- **Package Manager**: `npm`
- **System Requirements**: Linux, macOS, or Windows desktop environment with WebKit / WebView2 prerequisites

---

## Build Steps

### 1. Install Dependencies
```bash
# Frontend npm dependencies
npm install
```

### 2. Verify Backend Rust Compilation
```bash
cd src-tauri
cargo check
cd ..
```

### 3. Build Production Web Bundle
```bash
npm run build
```
- **Expected Output**: Vite bundle generated in `dist/` (`index.html`, CSS, and JS bundles).

### 4. Build Desktop Application Binary
```bash
npm run tauri build
```
- **Build Artifacts**:
  - Linux: `src-tauri/target/release/bundle/deb/` / `AppImage`
  - macOS: `src-tauri/target/release/bundle/dmg/` / `.app`
  - Windows: `src-tauri/target/release/bundle/msi/` / `.exe`

---

## Troubleshooting

### Build Fails with TypeScript Errors
- **Solution**: Run `npx tsc --noEmit` to identify type discrepancies in `src/`.

### Cargo Build Fails with Missing OpenSSL / Native Packages (Linux)
- **Solution**: Ensure `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev` are installed via `sudo apt install`.
