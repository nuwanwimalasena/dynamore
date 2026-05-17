import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Typed IPC API exposed to renderer
const api = {
    // Auth
    auth: {
        initSSO: (params: { startUrl: string; region: string }) =>
            ipcRenderer.invoke('auth:initSSO', params),
        pollSSOToken: (params: { region: string; clientId: string; clientSecret: string; deviceCode: string; interval: number; expiresAt: number }) =>
            ipcRenderer.invoke('auth:pollSSOToken', params),
        listSSOAccounts: (params: { accessToken: string; region: string }) =>
            ipcRenderer.invoke('auth:listSSOAccounts', params),
        listSSOAccountRoles: (params: { accessToken: string; region: string; accountId: string }) =>
            ipcRenderer.invoke('auth:listSSOAccountRoles', params),
        completeSSOLogin: (params: { accessToken: string; region: string; accountId: string; roleName: string; startUrl: string }) =>
            ipcRenderer.invoke('auth:completeSSOLogin', params),
        logout: () => ipcRenderer.invoke('auth:logout'),
        getSession: () => ipcRenderer.invoke('auth:getSession'),
        getLastSSOConfig: () => ipcRenderer.invoke('auth:getLastSSOConfig'),
        clearSSOConfig: () => ipcRenderer.invoke('auth:clearSSOConfig'),
        onSSOProgress: (callback: (step: string, message: string) => void) => {
            const listener = (_event: unknown, data: { step: string; message: string }) => callback(data.step, data.message)
            ipcRenderer.on('auth:ssoProgress', listener)
            return () => ipcRenderer.removeListener('auth:ssoProgress', listener)
        }
    },

    // Tables
    tables: {
        list: () => ipcRenderer.invoke('tables:list'),
        describe: (tableName: string) => ipcRenderer.invoke('tables:describe', tableName),
        create: (params: unknown) => ipcRenderer.invoke('tables:create', params),
        delete: (tableName: string) => ipcRenderer.invoke('tables:delete', tableName)
    },

    // Items
    items: {
        put: (params: { tableName: string; item: Record<string, unknown> }) =>
            ipcRenderer.invoke('items:put', params),
        get: (params: { tableName: string; key: Record<string, unknown> }) =>
            ipcRenderer.invoke('items:get', params),
        update: (params: unknown) => ipcRenderer.invoke('items:update', params),
        delete: (params: { tableName: string; key: Record<string, unknown> }) =>
            ipcRenderer.invoke('items:delete', params),
        batchDelete: (params: { tableName: string; keys: Record<string, unknown>[] }) =>
            ipcRenderer.invoke('items:batchDelete', params)
    },

    // Query & Scan
    query: {
        query: (params: unknown) => ipcRenderer.invoke('query:query', params),
        scan: (params: unknown) => ipcRenderer.invoke('query:scan', params)
    },

    // Auto-updater
    updater: {
        checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
        downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
        quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
        onChecking: (callback: () => void) => {
            const listener = () => callback()
            ipcRenderer.on('updater:checking', listener)
            return () => ipcRenderer.removeListener('updater:checking', listener)
        },
        onUpdateAvailable: (callback: (info: { version: string; releaseNotes: string }) => void) => {
            const listener = (_event: unknown, data: { version: string; releaseNotes: string }) => callback(data)
            ipcRenderer.on('updater:available', listener)
            return () => ipcRenderer.removeListener('updater:available', listener)
        },
        onUpdateNotAvailable: (callback: () => void) => {
            const listener = () => callback()
            ipcRenderer.on('updater:not-available', listener)
            return () => ipcRenderer.removeListener('updater:not-available', listener)
        },
        onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => {
            const listener = (_event: unknown, data: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => callback(data)
            ipcRenderer.on('updater:progress', listener)
            return () => ipcRenderer.removeListener('updater:progress', listener)
        },
        onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
            const listener = (_event: unknown, data: { version: string }) => callback(data)
            ipcRenderer.on('updater:downloaded', listener)
            return () => ipcRenderer.removeListener('updater:downloaded', listener)
        },
        onError: (callback: (err: { message: string }) => void) => {
            const listener = (_event: unknown, data: { message: string }) => callback(data)
            ipcRenderer.on('updater:error', listener)
            return () => ipcRenderer.removeListener('updater:error', listener)
        }
    }
}

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (for dev fallback)
    window.electron = electronAPI
    // @ts-ignore
    window.api = api
}
