import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn } from '@tauri-apps/api/event'

// Real Tauri IPC API — Direct invoke calls to Rust backend
export const api = {
    // Auth
    auth: {
        initSSO: (params: { startUrl: string; region: string }) =>
            invoke<any>('auth_init_sso', params),
        pollSSOToken: (params: { region: string; clientId: string; clientSecret: string; deviceCode: string; interval: number; expiresAt: number }) =>
            invoke<any>('auth_poll_sso_token', params),
        listSSOAccounts: (params: { accessToken: string; region: string }) =>
            invoke<any>('auth_list_sso_accounts', params),
        listSSOAccountRoles: (params: { accessToken: string; region: string; accountId: string }) =>
            invoke<any>('auth_list_sso_account_roles', params),
        completeSSOLogin: (params: { accessToken: string; region: string; ssoRegion?: string; accountId: string; roleName: string; startUrl: string }) =>
            invoke<any>('auth_complete_sso_login', params),
        loginWithKeys: (params: { accessKeyId: string; secretAccessKey: string; sessionToken?: string; region: string }) =>
            invoke<any>('auth_login_with_keys', params),
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
        list: () => invoke<any>('tables_list'),
        describe: (tableName: string) => invoke<any>('tables_describe', { tableName }),
        create: (params: unknown) => invoke<any>('tables_create', { params }),
        delete: (tableName: string) => invoke<any>('tables_delete', { tableName })
    },

    // Items
    items: {
        put: (params: { tableName: string; item: Record<string, unknown> }) =>
            invoke<any>('items_put', params),
        get: (params: { tableName: string; key: Record<string, unknown> }) =>
            invoke<any>('items_get', params),
        update: (params: unknown) => invoke<any>('items_update', { params }),
        delete: (params: { tableName: string; key: Record<string, unknown> }) =>
            invoke<any>('items_delete', params),
        batchDelete: (params: { tableName: string; keys: Record<string, unknown>[] }) =>
            invoke<any>('items_batch_delete', params)
    },

    // Query & Scan
    query: {
        query: (params: unknown) => invoke<any>('query_query', { params }),
        scan: (params: unknown) => invoke<any>('query_scan', { params })
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

// Map window.api to this module for global access in the existing codebase
declare global {
    interface Window {
        api: typeof api;
    }
}

window.api = api;
