import { IpcMain, BrowserWindow } from 'electron'
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

export function registerUpdaterHandlers(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
    // In development mode, skip real update checks to avoid errors
    if (is.dev) {
        ipcMain.handle('updater:checkForUpdates', () => ({ status: 'dev-mode' }))
        ipcMain.handle('updater:downloadUpdate', () => ({ status: 'dev-mode' }))
        ipcMain.handle('updater:quitAndInstall', () => undefined)
        return
    }

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    // Forward update events to the renderer
    autoUpdater.on('checking-for-update', () => {
        mainWindow.webContents.send('updater:checking')
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
        mainWindow.webContents.send('updater:available', {
            version: info.version,
            releaseNotes: info.releaseNotes ?? ''
        })
    })

    autoUpdater.on('update-not-available', () => {
        mainWindow.webContents.send('updater:not-available')
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        mainWindow.webContents.send('updater:progress', {
            percent: Math.round(progress.percent),
            transferred: progress.transferred,
            total: progress.total,
            bytesPerSecond: progress.bytesPerSecond
        })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
        mainWindow.webContents.send('updater:downloaded', {
            version: info.version
        })
    })

    autoUpdater.on('error', (err: Error) => {
        mainWindow.webContents.send('updater:error', { message: err.message })
    })

    // IPC handlers
    ipcMain.handle('updater:checkForUpdates', async () => {
        try {
            await autoUpdater.checkForUpdates()
            return { success: true }
        } catch (err) {
            return { success: false, error: (err as Error).message }
        }
    })

    ipcMain.handle('updater:downloadUpdate', async () => {
        try {
            await autoUpdater.downloadUpdate()
            return { success: true }
        } catch (err) {
            return { success: false, error: (err as Error).message }
        }
    })

    ipcMain.handle('updater:quitAndInstall', () => {
        autoUpdater.quitAndInstall()
    })
}

/**
 * Triggers an automatic update check after a short delay once the app is ready.
 * Only runs in production builds.
 */
export function scheduleUpdateCheck(): void {
    if (is.dev) return
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
            console.error('[updater] background check failed:', err?.message)
        })
    }, 5000) // wait 5s after startup
}
