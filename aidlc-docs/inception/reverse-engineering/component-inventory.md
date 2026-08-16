# Component Inventory

## Application Packages & Modules

### Frontend UI & State Modules (`src/`)
- `src/App.tsx`: Root lifecycle, routing state, initial session bootstrap.
- `src/api.ts`: Typed IPC client connecting React components to Rust commands.
- `src/theme.ts`: Custom Ant Design theme tokens and component styles.
- `src/index.css`: Global application styles, typography, scrollbars.
- `src/store/appStore.ts`: Global reactive Zustand store managing session and tables state.
- `src/pages/LoginPage.tsx`: Authentication screen supporting AWS SSO and IAM access keys.
- `src/pages/MainLayout.tsx`: Application shell containing sidebar, header, and active table views.
- `src/pages/TableDetailPage.tsx`: Table metadata viewer, schema viewer, and query/scan workspace.
- `src/pages/CreateTableWizard.tsx`: Wizard modal for table provisioning.
- `src/components/Sidebar.tsx`: Searchable table list with actions.
- `src/components/QueryBuilder.tsx`: DynamoDB Query interface for partition and sort keys.
- `src/components/ScanBuilder.tsx`: DynamoDB Scan interface with attribute filters.
- `src/components/ResultsGrid.tsx`: Dynamic data table with column sort, JSON viewer, and item deletion.
- `src/components/ItemEditor.tsx`: Modal for editing and adding items in JSON / form views.
- `src/components/UpdateNotification.tsx`: Update status dialog.

### Backend Native Modules (`src-tauri/`)
- `src-tauri/src/main.rs`: Tauri runtime entry point and IPC handler registration.
- `src-tauri/src/lib.rs`: Rust library definition.
- `src-tauri/src/aws_client.rs`: Dynamic AWS DynamoDB client factory and store-based session resolver.
- `src-tauri/src/commands/auth.rs`: SSO OIDC device registration, token polling, account/role enumeration, STS key login.
- `src-tauri/src/commands/tables.rs`: DynamoDB table list, describe, create, and delete commands.
- `src-tauri/src/commands/items.rs`: DynamoDB item put, get, update, delete, and batch delete commands.
- `src-tauri/src/commands/query.rs`: DynamoDB query and scan commands.

## Infrastructure & Configuration Packages
- `src-tauri/tauri.conf.json`: Tauri application configuration, window settings, and security permissions.
- `src-tauri/Cargo.toml`: Rust dependency management and compilation targets.
- `package.json`: Node.js dependency management and build scripts.
- `vite.config.ts`: Vite bundler configuration with React plugin and Tauri development port settings.
- `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`: TypeScript compiler configurations.

## Total Count
- **Total Modules / Key Files Analyzed**: 24
- **Application Frontend Components & Pages**: 14
- **Backend Rust Handlers & Utilities**: 7
- **Configuration & Build Manifests**: 5
