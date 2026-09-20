import { useState, useMemo } from 'react'
import { Table, Button, Space, Checkbox, Tooltip, Tag, Typography, Empty, App as AntApp } from 'antd'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAppStore } from '../store/appStore'

const { Text } = Typography

interface Props {
    items: Record<string, unknown>[]
    mode: 'query' | 'scan'
    onEdit: (item: Record<string, unknown>) => void
}

function renderCell(val: unknown): React.ReactNode {
    if (val === null || val === undefined) return <Text type="secondary">—</Text>
    if (typeof val === 'boolean') return <Tag color={val ? 'green' : 'red'}>{String(val)}</Tag>
    if (typeof val === 'object') return (
        <code style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            {JSON.stringify(val).slice(0, 80)}{JSON.stringify(val).length > 80 ? '…' : ''}
        </code>
    )
    const str = String(val)
    return <span title={str}>{str.length > 60 ? str.slice(0, 60) + '…' : str}</span>
}

export default function ResultsGrid({ items, mode, onEdit }: Props) {
    const { selectedTable, tableDetails, setQueryResults, setScanResults } = useAppStore()
    const { message, modal } = AntApp.useApp()
    const [selected, setSelected] = useState<Set<number>>(new Set())

    const currentTableDetail = selectedTable ? tableDetails[selectedTable] : undefined

    const extractPrimaryKey = (item: Record<string, unknown>): Record<string, unknown> => {
        const keySchema = currentTableDetail?.keySchema ?? currentTableDetail?.KeySchema ?? []
        if (keySchema.length > 0) {
            const keyObj: Record<string, unknown> = {}
            for (const k of keySchema) {
                const attrName = (k as any).attributeName ?? (k as any).AttributeName
                if (attrName && item[attrName] !== undefined) {
                    keyObj[attrName] = item[attrName]
                }
            }
            if (Object.keys(keyObj).length > 0) {
                return keyObj
            }
        }
        return Object.fromEntries(Object.entries(item).slice(0, 2))
    }

    const handleDeleteItem = async (item: Record<string, unknown>) => {
        modal.confirm({
            title: 'Delete this item?',
            content: 'This action cannot be undone.',
            okText: 'Delete',
            okType: 'danger',
            onOk: async () => {
                try {
                    const key = extractPrimaryKey(item)
                    const res = await window.api.items.delete({ tableName: selectedTable!, key })
                    if (res && res.success !== false) {
                        message.success('Item deleted')
                        const newItems = items.filter(i => i !== item)
                        if (mode === 'query') setQueryResults(newItems)
                        else setScanResults(newItems)
                    } else {
                        message.error('Delete failed')
                    }
                } catch (err: any) {
                    message.error(typeof err === 'string' ? err : err?.message ?? 'Delete failed')
                }
            }
        })
    }

    const handleBatchDelete = async () => {
        const selectedItems = items.filter((_, i) => selected.has(i))
        modal.confirm({
            title: `Delete ${selectedItems.length} item(s)?`,
            content: 'This action cannot be undone.',
            okText: 'Delete All',
            okType: 'danger',
            onOk: async () => {
                try {
                    const keys = selectedItems.map(item => extractPrimaryKey(item))
                    const res = await window.api.items.batchDelete({ tableName: selectedTable!, keys })
                    if (res && res.success !== false) {
                        message.success(`${selectedItems.length} item(s) deleted`)
                        const newItems = items.filter((_, i) => !selected.has(i))
                        if (mode === 'query') setQueryResults(newItems)
                        else setScanResults(newItems)
                        setSelected(new Set())
                    } else {
                        message.error('Batch delete failed')
                    }
                } catch (err: any) {
                    message.error(typeof err === 'string' ? err : err?.message ?? 'Batch delete failed')
                }
            }
        })
    }

    if (items.length === 0) {
        return (
            <Empty
                description="No results — run a query or scan above"
                style={{ marginTop: 60, color: 'var(--color-text-muted)' }}
            />
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 20px',
                borderBottom: '1px solid var(--color-border)',
                flexShrink: 0
            }}>
                <Checkbox
                    indeterminate={selected.size > 0 && selected.size < items.length}
                    checked={selected.size === items.length && items.length > 0}
                    onChange={e => setSelected(e.target.checked ? new Set(items.map((_, i) => i)) : new Set())}
                />
                <Text style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                    {items.length} item(s){selected.size > 0 ? `, ${selected.size} selected` : ''}
                </Text>
                {selected.size > 0 && (
                    <Button danger size="small" icon={<DeleteOutlined />} onClick={handleBatchDelete}>
                        Delete selected
                    </Button>
                )}
            </div>

            {/* Data grid */}
            <Table
                className="results-grid"
                dataSource={items}
                columns={columns}
                rowKey={(_, i) => String(i)}
                scroll={{ x: 'max-content', y: 'calc(100vh - 340px)' }}
                size="small"
                pagination={false}
                rowSelection={{
                    type: 'checkbox',
                    selectedRowKeys: [...selected].map(String),
                    onChange: (keys) => setSelected(new Set(keys.map(Number)))
                }}
            />
        </div>
    )
}
