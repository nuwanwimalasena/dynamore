import { useEffect, useCallback, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Typography, Button, Tooltip, App as AntApp, Select } from 'antd'
import { LogoutOutlined, SunOutlined, MoonOutlined, GlobalOutlined } from '@ant-design/icons'
import logoUrl from '../assets/logo.png'
import { useAppStore } from '../store/appStore'
import { AWS_REGIONS } from '../constants/regions'
import Sidebar from '../components/Sidebar'
import TableDetailPage from './TableDetailPage'

const { Text } = Typography

export default function MainLayout() {
    const { session, setSession, setTableNames, setSelectedTable, theme, setTheme } = useAppStore()
    const { message } = AntApp.useApp()
    const [switchingRegion, setSwitchingRegion] = useState(false)

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

    const handleRegionChange = async (newRegion: string) => {
        if (!session || newRegion === session.region || switchingRegion) return
        setSwitchingRegion(true)
        try {
            const res = await window.api.auth.switchRegion(newRegion)
            if (res.success) {
                setSession({
                    ...session,
                    region: res.region
                })
                setSelectedTable(null)
                message.success(`Switched region to ${res.region}`)
            }
        } catch (err: any) {
            message.error(typeof err === 'string' ? err : err?.message ?? 'Failed to switch region')
        } finally {
            setSwitchingRegion(false)
        }
    }

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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', minHeight: 600, minWidth: 900, width: '100%', flex: 1 }}>
            {/* Titlebar */}
            <div className="titlebar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 16 }}>
                    <img
                        src={logoUrl}
                        alt="Dynamore Logo"
                        style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            objectFit: 'contain',
                            display: 'block'
                        }}
                    />
                    <Text style={{
                        color: 'var(--color-text-primary)',
                        fontWeight: 700,
                        fontSize: 16,
                        letterSpacing: '-0.3px',
                        lineHeight: 1
                    }}>
                        Dynamore
                    </Text>
                </div>

                <div style={{ flex: 1 }} />

                {session && (
                    <div className="titlebar-nodrag" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: 16 }}>
                        {(session.accountId || session.roleName) && (
                            <Text style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                                {[session.accountId, session.roleName].filter(Boolean).join(' / ')}
                            </Text>
                        )}

                        <Select
                            size="small"
                            value={session.region || 'us-east-1'}
                            onChange={handleRegionChange}
                            loading={switchingRegion}
                            showSearch
                            optionFilterProp="label"
                            suffixIcon={<GlobalOutlined style={{ color: 'var(--color-accent-blue)' }} />}
                            style={{ width: 230 }}
                            options={AWS_REGIONS}
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase()) ||
                                (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        />

                        <Tooltip title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}>
                            <Button
                                type="text"
                                size="small"
                                className="titlebar-btn"
                                icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
                                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                            />
                        </Tooltip>
                        <Tooltip title="Log out">
                            <Button
                                type="text"
                                size="small"
                                className="titlebar-btn"
                                icon={<LogoutOutlined />}
                                onClick={handleLogout}
                            />
                        </Tooltip>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="app-layout" style={{ '--sidebar-width': `${sidebarWidth}px`, flex: 1, height: 'calc(100% - var(--titlebar-height, 48px))' } as React.CSSProperties}>
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
