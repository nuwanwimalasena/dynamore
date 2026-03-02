import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, App as AntApp } from 'antd'
import App from '../App'
import theme from '../theme'
import '../index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <ConfigProvider theme={theme}>
            <AntApp>
                <App />
            </AntApp>
        </ConfigProvider>
    </React.StrictMode>
)
