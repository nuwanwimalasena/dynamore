import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, App as AntApp } from 'antd'
import App from '../App'
import { darkTheme, lightTheme } from '../theme'
import { useAppStore } from '../store/appStore'
import '../index.css'

function Root() {
    const theme = useAppStore((state) => state.theme)

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
    }, [theme])

    return (
        <ConfigProvider theme={theme === 'light' ? lightTheme : darkTheme}>
            <AntApp>
                <App />
            </AntApp>
        </ConfigProvider>
    )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>
)
