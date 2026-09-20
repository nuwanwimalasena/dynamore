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
        try {
            const res = await window.api.tables.list()
            if (res && res.tableNames) {
                setTableNames(res.tableNames)
                if (res.tableNames.length > 0) {
                    const toSelect = (selectedTable && res.tableNames.includes(selectedTable))
                        ? selectedTable
                        : res.tableNames[0]
                    handleSelectTable(toSelect)
                } else {
                    setSelectedTable(null)
                }
            } else if (res && !res.success) {
                message.error(res.error ?? 'Failed to list tables')
            }
        } catch (err: any) {
            message.error(typeof err === 'string' ? err : err?.message ?? 'Failed to list tables')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadTables()
    }, [session?.region]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleSelectTable = async (name: string) => {
        setSelectedTable(name)
        try {
            const res = await window.api.tables.describe(name)
            if (res && res.table) {
                setTableDetail(name, res.table)
            }
        } catch (err: any) {
            message.error(typeof err === 'string' ? err : err?.message ?? `Failed to describe table "${name}"`)
        }
    }

    const handleDeleteTable = async (name: string) => {
        modal.confirm({
            title: `Delete "${name}"?`,
            content: 'This action is irreversible. All data in the table will be permanently deleted.',
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            async onOk() {
                try {
                    const res = await window.api.tables.delete(name)
                    if (res.success) {
                        message.success(`Table "${name}" deleted`)
                        if (selectedTable === name) {
                            setSelectedTable(null)
                        }
                        loadTables()
                    } else {
                        message.error(res.error ?? 'Failed to delete table')
                    }
                } catch (err: any) {
                    message.error(err?.message ?? 'Failed to delete table')
                }
            }
        })
    }

    const filtered = tableNames.filter(name =>
        name.toLowerCase().includes(search.toLowerCase())
    )

    const pinnedList = filtered.filter(name => pinnedTables.includes(name))
    const regularList = filtered.filter(name => !pinnedTables.includes(name))

    const renderTableItem = (name: string, isPinned: boolean) => {
        const isSelected = selectedTable === name
        return (
            <div
                key={name}
                onClick={() => handleSelectTable(name)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 12px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--color-primary-subtle)' : 'transparent',
                    border: isSelected ? '1px solid var(--color-primary-border)' : '1px solid transparent',
                    transition: 'all var(--transition-fast)',
                    group: 'item',
                    marginBottom: 2
                }}
                className="sidebar-table-item"
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <TableOutlined style={{
                        color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        fontSize: 13,
                        flexShrink: 0
                    }} />
                    <span style={{
                        color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                        fontWeight: isSelected ? 500 : 400,
                        fontSize: 12,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {name}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <Tooltip title={isPinned ? 'Unpin' : 'Pin to top'}>
                        <Button
                            type="text"
                            size="small"
                            icon={isPinned ? <PushpinFilled style={{ color: 'var(--color-accent)' }} /> : <PushpinOutlined />}
                            onClick={e => togglePin(name, e)}
                            style={{ width: 22, height: 22, padding: 0, opacity: isPinned ? 1 : 0.6 }}
                        />
                    </Tooltip>
                    <Tooltip title="Delete table">
                        <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={e => { e.stopPropagation(); handleDeleteTable(name) }}
                            style={{ width: 22, height: 22, padding: 0, opacity: 0.6 }}
                        />
                    </Tooltip>
                </div>
            </div>
        )
    }

    return (
        <aside style={{
            width: 260,
            background: 'var(--color-surface-1)',
            borderRight: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            userSelect: 'none'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 14px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <Text style={{
                    color: 'var(--color-text-secondary)',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px'
                }}>
                    Tables ({tableNames.length})
                </Text>
                <div style={{ display: 'flex', gap: 4 }}>
                    <Tooltip title="Refresh tables">
                        <Button
                            type="text"
                            size="small"
                            icon={<ReloadOutlined spin={loading} />}
                            onClick={loadTables}
                            disabled={loading}
                        />
                    </Tooltip>
                    <Tooltip title="Create new table">
                        <Button
                            type="text"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => setShowCreate(true)}
                        />
                    </Tooltip>
                </div>
            </div>

            {/* Search */}
            <div style={{ padding: '0 12px 8px' }}>
                <Input
                    placeholder="Filter tables..."
                    prefix={<SearchOutlined style={{ color: 'var(--color-text-muted)', fontSize: 12 }} />}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    allowClear
                    size="small"
                />
            </div>

            {/* Table list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
                {loading && tableNames.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Spin size="small" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 16px',
                        color: 'var(--color-text-muted)',
                        fontSize: 12
                    }}>
                        {search ? 'No tables match filter' : 'No DynamoDB tables found in this region'}
                    </div>
                ) : (
                    <>
                        {pinnedList.length > 0 && (
                            <>
                                <div style={{
                                    fontSize: 10,
                                    color: 'var(--color-text-muted)',
                                    padding: '4px 6px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    Pinned
                                </div>
                                {pinnedList.map(name => renderTableItem(name, true))}
                                {regularList.length > 0 && (
                                    <Divider style={{ margin: '6px 0', borderColor: 'var(--color-border)' }} />
                                )}
                            </>
                        )}
                        {regularList.map(name => renderTableItem(name, false))}
                    </>
                )}
            </div>

            {/* Create table wizard */}
            <CreateTableWizard
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={newTableName => {
                    loadTables()
                    handleSelectTable(newTableName)
                }}
            />
        </aside>
    )
}
