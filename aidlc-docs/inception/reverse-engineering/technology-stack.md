# Technology Stack

## Programming Languages
- **TypeScript**: 5.4.5 (Frontend application logic and type declarations)
- **Rust**: 1.77.2+ / Edition 2021 (Backend desktop core, IPC commands, AWS SDK integration)
- **CSS3 / HTML5**: Modern styling, dark mode tokens, flexbox/grid layouts

## Frameworks & Libraries
- **Tauri**: 2.11.2 (Desktop application framework)
- **React**: 18.3.1 (Component architecture and UI rendering)
- **Ant Design**: 5.18.3 (UI design system, modals, tables, forms, icons)
- **Zustand**: 4.5.4 (Lightweight state management)
- **Tokio**: 1.0 (Async runtime for Rust backend)
- **Serde & Serde JSON**: 1.0 (Serialization framework for Rust)
- **Serde Dynamo**: 4.0 (DynamoDB AttributeValue marshaling)

## Cloud & SDK Integrations
- **AWS SDK for Rust (`aws-sdk-dynamodb`)**: 1.23
- **AWS SDK for Rust (`aws-sdk-sso`)**: 1.21
- **AWS SDK for Rust (`aws-sdk-ssooidc`)**: 1.21
- **AWS SDK for Rust (`aws-sdk-sts`)**: 1.21
- **AWS Config (`aws-config`)**: 1.1
- **AWS Credential Types (`aws-credential-types`)**: 1.2.10

## Build & Tooling
- **Vite**: 5.3.1 (Frontend development server and asset bundler)
- **Cargo**: Rust package manager and compiler driver
- **Tauri CLI**: 2.11.2 (Cross-platform packaging and code generation)
- **ESLint**: 8.57.0 with `@typescript-eslint` (Code quality and linting)

## Testing Tools
- **Vitest**: 1.6.0 (Unit and integration testing framework configured in devDependencies)
