import { useEffect, useState } from 'react'
import { Input, Button, Tooltip, Spin, App as AntApp, Modal, Typography, Divider } from 'antd'
import {
    TableOutlined,
    SearchOutlined,
    PlusOutlined,
    ReloadOutlined,
    DeleteOutlined,
    PushpinOutlined,
    PushpinFilled
} from '@ant-design/icons'
import { useAppStore } from '../store/appStore'
import CreateTableWizard from '../pages/CreateTableWizard'

const { Text } = Typography

export default function Sidebar() {
    const { tableNames, selectedTable, setTableNames, setSelectedTable, setTableDetail, session } = useAppStore()
    const { message, modal } = AntApp.useApp()
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [pinnedTables, setPinnedTables] = useState<string[]>([])

    const getStorageKey = () => {
        if (!session) return ''
        return `pinned:${session.roleName}:${session.accountId}:${session.region}`
    }

    useEffect(() => {
        const key = getStorageKey()
        if (key) {
            const saved = localStorage.getItem(key)
            setPinnedTables(saved ? JSON.parse(saved) : [])
        } else {
            setPinnedTables([])
        }
    }, [session])

    const togglePin = (name: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const key = getStorageKey()
        if (!key) return
        const newPinned = pinnedTables.includes(name)
            ? pinnedTables.filter(t => t !== name)
            : [...pinnedTables, name]
        setPinnedTables(newPinned)
        localStorage.setItem(key, JSON.stringify(newPinned))
    }

    const loadTables = async () => {
        setLoading(true)
        const res = await window.api.tables.list()
        if (res.success && res.tableNames) {
            setTableNames(res.tableNames)
            if (!selectedTable && res.tableNames.length > 0) {
                handleSelectTable(res.tableNames[0])
            }
        } else {
            message.error(res.error ?? 'Failed to list tables')
        }
        setLoading(false)
    }

    useEffect(() => {
        loadTables()
    }, [])// eslint-disable-line react-hooks/exhaustive-deps

    const handleSelectTable = async (name: string) => {
        setSelectedTable(name)
        const res = await window.api.tables.describe(name)
        if (res.success && res.table) {
            setTableDetail(name, res.table)
        }
    }

    const handleDeleteTable = async (name: string) => {
        modal.confirm({
            title: `Delete "${name}"?`,
            content: 'This action is irreversible. All data in the table will be permanently deleted.',
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                const res = await window.api.tables.delete(name)
                if (res.success) {
                    message.success(`Table "${name}" deleted`)
                    setSelectedTable(null)
                    await loadTables()
                } else {
                    message.error(res.error ?? 'Delete failed')
                }
            }
        })
    }

    const filtered = tableNames.filter((n) => n.toLowerCase().includes(search.toLowerCase()))
    const filteredPinned = filtered.filter((n) => pinnedTables.includes(n))
    const filteredUnpinned = filtered.filter((n) => !pinnedTables.includes(n))

    const renderTableItem = (name: string, isPinned: boolean) => {
        return (
            <div
                key={name}
                className={`sidebar-item ${selectedTable === name ? 'active' : ''}`}
                onClick={() => handleSelectTable(name)}
                title={name}
                style={{ justifyContent: 'space-between', paddingRight: 8 }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    <TableOutlined style={{ flexShrink: 0, fontSize: 13 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <Tooltip title={isPinned ? "Unpin table" : "Pin table"}>
                        <Button
                            type="text"
                            size="small"
                            className="pin-btn"
                            icon={isPinned ? <PushpinFilled style={{ color: 'var(--color-accent-blue)' }} /> : <PushpinOutlined />}
                            onClick={(e) => togglePin(name, e)}
                            style={{
                                opacity: isPinned ? 1 : 0,
                                color: isPinned ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
                                transition: 'opacity 0.2s ease',
                            }}
                        />
                    </Tooltip>
                    {selectedTable === name && (
                        <Tooltip title="Delete table">
                            <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={(e) => { e.stopPropagation(); handleDeleteTable(name) }}
                                style={{ opacity: 0.6 }}
                            />
                        </Tooltip>
                    )}
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="sidebar">
                {/* Header */}
                <div className="sidebar-header">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <Text style={{ color: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                            Tables ({tableNames.length})
                        </Text>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <Tooltip title="Refresh">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<ReloadOutlined spin={loading} />}
                                    onClick={loadTables}
                                    style={{ color: 'var(--color-text-secondary)' }}
                                />
                            </Tooltip>
                            <Tooltip title="Create table">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={() => setShowCreate(true)}
                                    style={{ color: 'var(--color-accent-blue)' }}
                                />
                            </Tooltip>
                        </div>
                    </div>
                    <Input
                        size="small"
                        prefix={<SearchOutlined style={{ color: 'var(--color-text-muted)' }} />}
                        placeholder="Filter tables…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        allowClear
                    />
                </div>

                {/* Table list */}
                <div className="sidebar-list">
                    {loading && tableNames.length === 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
                            <Spin size="small" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center' }}>
                            <Text style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                                {search ? 'No match' : 'No tables found'}
                            </Text>
                        </div>
                    ) : pinnedTables.length > 0 ? (
                        <>
                            {filteredPinned.length > 0 && (
                                <>
                                    <div style={{ padding: '8px 16px 4px 16px' }}>
                                        <Text style={{ color: 'var(--color-text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', opacity: 0.8 }}>
                                            Pinned
                                        </Text>
                                    </div>
                                    {filteredPinned.map((name) => renderTableItem(name, true))}
                                </>
                            )}
                            {filteredUnpinned.length > 0 && (
                                <>
                                    {filteredPinned.length > 0 && <Divider style={{ margin: '8px 0', borderColor: 'var(--color-border)' }} />}
                                    <div style={{ padding: '8px 16px 4px 16px' }}>
                                        <Text style={{ color: 'var(--color-text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', opacity: 0.8 }}>
                                            Other Tables
                                        </Text>
                                    </div>
                                    {filteredUnpinned.map((name) => renderTableItem(name, false))}
                                </>
                            )}
                        </>
                    ) : (
                        filtered.map((name) => renderTableItem(name, false))
                    )}
                </div>
            </div>

            <CreateTableWizard
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={(name: string) => {
                    setShowCreate(false)
                    loadTables().then(() => handleSelectTable(name))
                }}
            />
        </>
    )
}
