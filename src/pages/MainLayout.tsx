import { useEffect, useCallback, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Typography, Button, Tooltip, App as AntApp } from 'antd'
import { LogoutOutlined, CloudServerOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons'
import { useAppStore } from '../store/appStore'
import Sidebar from '../components/Sidebar'
import TableDetailPage from './TableDetailPage'

const { Text } = Typography

export default function MainLayout() {
    const { session, setSession, setTableNames, theme, setTheme } = useAppStore()
    const { message } = AntApp.useApp()

    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('sidebarWidth')
        return saved ? parseInt(saved, 10) : 240
    })
    const [isResizing, setIsResizing] = useState(false)

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizing(true)
    }, [])

    useEffect(() => {
        if (!isResizing) return

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(160, Math.min(600, e.clientX))
            setSidebarWidth(newWidth)
        }

        const handleMouseUp = () => {
            setIsResizing(false)
        }

        document.body.classList.add('resizing')
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)

        return () => {
            document.body.classList.remove('resizing')
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing])

    useEffect(() => {
        if (!isResizing) {
            localStorage.setItem('sidebarWidth', sidebarWidth.toString())
        }
    }, [sidebarWidth, isResizing])

    const handleLogout = useCallback(async () => {
        await window.api.auth.logout()
        setSession(null)
        setTableNames([])
    }, [setSession, setTableNames])

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>
        if (session) {
            // Auto-logout ~1 min before credentials expire
            // credentials expire in ~1 hour for STS tokens
            timer = setTimeout(() => {
                message.warning('Session expired – please log in again')
                handleLogout()
            }, 55 * 60 * 1000)
        }
        return () => clearTimeout(timer)
    }, [session, handleLogout, message])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            {/* Titlebar */}
            <div className="titlebar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 80 }}>
                    <CloudServerOutlined style={{ color: 'var(--color-accent-blue)', fontSize: 16 }} />
                    <Text style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: 13 }}>
                        Dynamore
                    </Text>
                </div>

                <div style={{ flex: 1 }} />

                {session && (
                    <div className="titlebar-nodrag" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: 16 }}>
                        <Text style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                            {session.accountId} / {session.roleName} / {session.region}
                        </Text>
                        <Tooltip title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}>
                            <Button
                                type="text"
                                size="small"
                                icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
                                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                                style={{ color: 'var(--color-text-secondary)' }}
                            />
                        </Tooltip>
                        <Tooltip title="Log out">
                            <Button
                                type="text"
                                size="small"
                                icon={<LogoutOutlined />}
                                onClick={handleLogout}
                                style={{ color: 'var(--color-text-secondary)' }}
                            />
                        </Tooltip>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="app-layout" style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}>
                <Sidebar />
                <div
                    className={`sidebar-resizer ${isResizing ? 'resizing' : ''}`}
                    onMouseDown={startResizing}
                />
                <div className="main-content">
                    <Routes>
                        <Route path="/tables" element={<TableDetailPage />} />
                        <Route path="*" element={<Navigate to="/tables" replace />} />
                    </Routes>
                </div>
            </div>
        </div>
    )
}
