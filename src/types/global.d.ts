// Type declarations for the IPC API exposed via contextBridge

export interface Session {
    accountId?: string
    roleName?: string
    region: string
    authType: 'sso' | 'keys'
}

export interface AWSAccount {
    accountId: string
    accountName: string
    emailAddress?: string
}

export interface AWSRole {
    roleName: string
    accountId: string
}

export interface TableDescription {
    tableName?: string
    TableName?: string
    tableStatus?: string
    TableStatus?: string
    itemCount?: number
    ItemCount?: number
    tableSizeBytes?: number
    TableSizeBytes?: number
    billingModeSummary?: { billingMode?: string; BillingMode?: string }
    BillingModeSummary?: { billingMode?: string; BillingMode?: string }
    provisionedThroughput?: {
        readCapacityUnits?: number
        writeCapacityUnits?: number
        ReadCapacityUnits?: number
        WriteCapacityUnits?: number
    }
    ProvisionedThroughput?: {
        readCapacityUnits?: number
        writeCapacityUnits?: number
        ReadCapacityUnits?: number
        WriteCapacityUnits?: number
    }
    keySchema?: Array<{ attributeName?: string; AttributeName?: string; keyType?: string; KeyType?: string }>
    KeySchema?: Array<{ attributeName?: string; AttributeName?: string; keyType?: string; KeyType?: string }>
    attributeDefinitions?: Array<{ attributeName?: string; AttributeName?: string; attributeType?: string; AttributeType?: string }>
    AttributeDefinitions?: Array<{ attributeName?: string; AttributeName?: string; attributeType?: string; AttributeType?: string }>
    globalSecondaryIndexes?: unknown[]
    GlobalSecondaryIndexes?: unknown[]
    localSecondaryIndexes?: unknown[]
    LocalSecondaryIndexes?: unknown[]
    creationDateTime?: string
    CreationDateTime?: string
}

export interface QueryResult {
    success: boolean
    items?: Record<string, unknown>[]
    count?: number
    scannedCount?: number
    lastEvaluatedKey?: Record<string, unknown>
    error?: string
}

declare global {
    interface Window {
        api: {
            auth: {
                initSSO: (params: { startUrl: string; region?: string }) => Promise<{
                    deviceCode: string
                    userCode: string
                    verificationUri: string
                    verificationUriComplete: string
                    expiresIn: number
                    interval: number
                    clientId: string
                    clientSecret: string
                    region: string
                }>
                pollSSOToken: (params: {
                    region: string
                    clientId: string
                    clientSecret: string
                    deviceCode: string
                    interval: number
                    expiresAt: number
                }) => Promise<{ accessToken: string; expiresIn: number }>
                listSSOAccounts: (params: {
                    accessToken: string
                    region: string
                }) => Promise<{ accounts: AWSAccount[] }>
                listSSOAccountRoles: (params: {
                    accessToken: string
                    region: string
                    accountId: string
                }) => Promise<{ roles: AWSRole[] }>
                completeSSOLogin: (params: {
                    accessToken: string
                    region?: string
                    ssoRegion?: string
                    accountId: string
                    roleName: string
                    startUrl: string
                }) => Promise<{ success: boolean; error?: string; accountId?: string; roleName?: string; region?: string }>
                loginWithKeys: (params: {
                    accessKeyId: string
                    secretAccessKey: string
                    sessionToken?: string
                    region?: string
                }) => Promise<{ success: boolean; error?: string; region?: string }>
                switchRegion: (region: string) => Promise<{ success: boolean; region: string }>
                logout: () => Promise<{ success: boolean }>
                getSession: () => Promise<Session | null>
                getLastSSOConfig: () => Promise<{ startUrl: string; region: string; accountId: string; roleName: string } | null>
                clearSSOConfig: () => Promise<{ success: boolean }>
                onSSOProgress: (callback: (step: string, message: string) => void) => () => void
            }
            tables: {
                list: () => Promise<{ success: boolean; tableNames?: string[]; error?: string }>
                describe: (tableName: string) => Promise<{ success: boolean; table?: TableDescription; error?: string }>
                create: (params: unknown) => Promise<{ success: boolean; table?: TableDescription; error?: string }>
                delete: (tableName: string) => Promise<{ success: boolean; error?: string }>
            }
            items: {
                put: (params: { tableName: string; item: Record<string, unknown> }) => Promise<{ success: boolean; error?: string }>
                get: (params: { tableName: string; key: Record<string, unknown> }) => Promise<{ success: boolean; item?: Record<string, unknown>; error?: string }>
                update: (params: unknown) => Promise<{ success: boolean; attributes?: Record<string, unknown>; error?: string }>
                delete: (params: { tableName: string; key: Record<string, unknown> }) => Promise<{ success: boolean; error?: string }>
                batchDelete: (params: { tableName: string; keys: Record<string, unknown>[] }) => Promise<{ success: boolean; deletedCount?: number; error?: string }>
            }
            query: {
                query: (params: unknown) => Promise<QueryResult>
                scan: (params: unknown) => Promise<QueryResult>
            }
        }
    }
}
