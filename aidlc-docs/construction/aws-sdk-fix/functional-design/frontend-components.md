# Frontend Component Integration & Contracts: Unit `aws-sdk-fix`

## 1. IPC Client Contract Updates (`src/api.ts`)

```typescript
export interface TableDescription {
    tableName: string;
    tableStatus: string;
    itemCount?: number;
    tableSizeBytes?: number;
    creationDateTime?: string;
    billingModeSummary?: { billingMode: string };
    provisionedThroughput?: { readCapacityUnits: number; writeCapacityUnits: number };
    keySchema: Array<{ attributeName: string; keyType: 'HASH' | 'RANGE' }>;
    attributeDefinitions: Array<{ attributeName: string; attributeType: 'S' | 'N' | 'B' }>;
    globalSecondaryIndexes?: Array<any>;
    localSecondaryIndexes?: Array<any>;
}

export interface QueryResult {
    items: Array<Record<string, any>>;
    count: number;
    scannedCount: number;
    lastEvaluatedKey?: Record<string, any>;
}

export const api = {
    auth: {
        initSSO: (params: { startUrl: string; region: string }): Promise<SsoInitResponse> =>
            invoke('auth_init_sso', params),
        pollSSOToken: (params: { region: string; clientId: string; clientSecret: string; deviceCode: string; interval: number; expiresAt: number }): Promise<SsoTokenResponse> =>
            invoke('auth_poll_sso_token', params),
        listSSOAccounts: (params: { accessToken: string; region: string }): Promise<SsoAccountsResponse> =>
            invoke('auth_list_sso_accounts', params),
        listSSOAccountRoles: (params: { accessToken: string; region: string; accountId: string }): Promise<SsoRolesResponse> =>
            invoke('auth_list_sso_account_roles', params),
        completeSSOLogin: (params: { accessToken: string; region: string; ssoRegion?: string; accountId: string; roleName: string; startUrl: string }): Promise<CompleteSsoLoginResponse> =>
            invoke('auth_complete_sso_login', params),
        loginWithKeys: (params: { accessKeyId: string; secretAccessKey: string; sessionToken?: string; region: string }): Promise<LoginWithKeysResponse> =>
            invoke('auth_login_with_keys', params),
        logout: (): Promise<void> => invoke('auth_logout'),
        getSession: (): Promise<SessionResponse | null> => invoke('auth_get_session'),
        getLastSSOConfig: (): Promise<LastSsoConfig | null> => invoke('auth_get_last_sso_config'),
        clearSSOConfig: (): Promise<void> => invoke('auth_clear_sso_config'),
    },
    tables: {
        list: (): Promise<{ tableNames: string[] }> => invoke('tables_list'),
        describe: (tableName: string): Promise<{ table: TableDescription }> => invoke('tables_describe', { tableName }),
        create: (params: unknown): Promise<{ table: TableDescription }> => invoke('tables_create', { params }),
        delete: (tableName: string): Promise<void> => invoke('tables_delete', { tableName })
    },
    items: {
        put: (params: { tableName: string; item: Record<string, unknown> }): Promise<void> =>
            invoke('items_put', params),
        get: (params: { tableName: string; key: Record<string, unknown> }): Promise<{ item: Record<string, unknown> | null }> =>
            invoke('items_get', params),
        update: (params: unknown): Promise<{ attributes?: Record<string, unknown> }> =>
            invoke('items_update', { params }),
        delete: (params: { tableName: string; key: Record<string, unknown> }): Promise<void> =>
            invoke('items_delete', params),
        batchDelete: (params: { tableName: string; keys: Record<string, unknown>[] }): Promise<{ deletedCount: number }> =>
            invoke('items_batch_delete', params)
    },
    query: {
        query: (params: QueryParams): Promise<QueryResult> => invoke('query_query', { params }),
        scan: (params: ScanParams): Promise<QueryResult> => invoke('query_scan', { params })
    }
};
```

---

## 2. Component Integration & Error Handling Flow

### `LoginPage.tsx`
- Replaces manual `.error` inspections with direct Promise `try/catch` and `message.error(err)`.
- Strips empty session token string before dispatching to `loginWithKeys`.

### `TableDetailPage.tsx`
- Catches describe table failures (e.g. table deleted or not accessible) and triggers global error banner.
- Seamlessly updates table list on table deletion.

### `QueryBuilder.tsx` & `ScanBuilder.tsx`
- Dispatches query and scan params.
- Automatically handles multi-item responses from internal accumulation.
- Renders `LastEvaluatedKey` pagination control when more items remain in the table.

### `ItemEditor.tsx`
- Type validation on fields: numbers parsed to JavaScript numbers before dispatching to `items_put` / `items_update`.
- Clean error dialog display on conditional check failure or attribute validation rejection.
