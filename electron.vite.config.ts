import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: {
            lib: {
                entry: resolve('electron/main/index.ts')
            }
        },
        resolve: {
            alias: {
                '@main': resolve('electron/main')
            }
        }
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            lib: {
                entry: resolve('electron/preload/index.ts')
            }
        }
    },
    renderer: {
        root: resolve('src/renderer'),
        build: {
            rollupOptions: {
                input: resolve('src/renderer/index.html')
            }
        },
        resolve: {
            alias: {
                '@': resolve('src'),
                '@renderer': resolve('src')
            }
        },
        plugins: [react()]
    }
})
