import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import type {
    CreateTableRequest,
    TableCreateResponse,
    TableDeleteResponse,
    TableDescribeResponse,
    TableListResponse,
    PutItemRequest,
    GetItemRequest,
    UpdateItemRequest,
    DeleteItemRequest,
    BatchDeleteItemsRequest,
    ItemResponse,
    MutationResponse,
    QueryRequest,
    ScanRequest,
    QueryResultDto
} from './types/dynamo'

// Strongly-typed Tauri IPC Bridge
export const api = {
    // Auth
    auth: {
        initSSO: (params: { startUrl: string; region?: string }) =>
            invoke<any>('auth_init_sso', params),
        pollSSOToken: (params: { region: string; clientId: string; clientSecret: string; deviceCode: string; interval: number; expiresAt: number }) =>
            invoke<any>('auth_poll_sso_token', params),
        listSSOAccounts: (params: { accessToken: string; region: string }) =>
            invoke<any>('auth_list_sso_accounts', params),
        listSSOAccountRoles: (params: { accessToken: string; region: string; accountId: string }) =>
            invoke<any>('auth_list_sso_account_roles', params),
        completeSSOLogin: (params: { accessToken: string; region?: string; ssoRegion?: string; accountId: string; roleName: string; startUrl: string }) =>
            invoke<any>('auth_complete_sso_login', params),
        loginWithKeys: (params: { accessKeyId: string; secretAccessKey: string; sessionToken?: string; region?: string }) =>
            invoke<any>('auth_login_with_keys', params),
        switchRegion: (region: string) =>
            invoke<{ success: boolean; region: string }>('auth_switch_region', { region }),
        logout: () => invoke<any>('auth_logout'),
        getSession: () => invoke<any>('auth_get_session'),
        getLastSSOConfig: () => invoke<any>('auth_get_last_sso_config'),
        clearSSOConfig: () => invoke<any>('auth_clear_sso_config'),
        onSSOProgress: (callback: (step: string, message: string) => void) => {
            let unlisten: UnlistenFn | null = null;
            listen<{ step: string; message: string }>('auth:ssoProgress', (event) => {
                callback(event.payload.step, event.payload.message);
            }).then(u => { unlisten = u; }).catch(() => {});
            return () => { if (unlisten) unlisten(); }
        }
    },

    // Tables
    tables: {
        list: (): Promise<TableListResponse> =>
            invoke<TableListResponse>('tables_list'),
        describe: (tableName: string): Promise<TableDescribeResponse> =>
            invoke<TableDescribeResponse>('tables_describe', { tableName }),
        create: (req: CreateTableRequest): Promise<TableCreateResponse> =>
            invoke<TableCreateResponse>('tables_create', { req }),
        delete: (tableName: string): Promise<TableDeleteResponse> =>
            invoke<TableDeleteResponse>('tables_delete', { tableName })
    },

    // Items
    items: {
        put: (params: PutItemRequest): Promise<MutationResponse> =>
            invoke<MutationResponse>('items_put', params),
        get: (params: GetItemRequest): Promise<ItemResponse> =>
            invoke<ItemResponse>('items_get', params),
        update: (req: UpdateItemRequest): Promise<ItemResponse> =>
            invoke<ItemResponse>('items_update', { req }),
        delete: (params: DeleteItemRequest): Promise<MutationResponse> =>
            invoke<MutationResponse>('items_delete', params),
        batchDelete: (params: BatchDeleteItemsRequest): Promise<MutationResponse> =>
            invoke<MutationResponse>('items_batch_delete', params)
    },

    // Query & Scan
    query: {
        query: (req: QueryRequest): Promise<QueryResultDto> =>
            invoke<QueryResultDto>('query_query', { req }),
        scan: (req: ScanRequest): Promise<QueryResultDto> =>
            invoke<QueryResultDto>('query_scan', { req })
    },

    // Auto-updater
    updater: {
        checkForUpdates: () => invoke<any>('updater_check_for_updates'),
        downloadUpdate: () => invoke<any>('updater_download_update'),
        quitAndInstall: () => invoke<any>('updater_quit_and_install'),
        onChecking: () => () => {},
        onUpdateAvailable: () => () => {},
        onUpdateNotAvailable: () => () => {},
        onDownloadProgress: () => () => {},
        onUpdateDownloaded: () => () => {},
        onError: () => () => {}
    }
}

declare global {
    interface Window {
        api: typeof api;
    }
}

window.api = api;
