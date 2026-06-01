import { useState, useEffect } from 'react'
import { Drawer, Button, Space, Tabs, Typography, App as AntApp, Alert, Input, Select } from 'antd'
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useAppStore } from '../store/appStore'

const { Text } = Typography
const { Option } = Select

interface Props {
    open: boolean
    item: Record<string, unknown> | null
    onClose: () => void
    onSaved: () => void
}

interface KeyValueRow {
    key: string
    type: 'string' | 'number' | 'boolean' | 'null' | 'list' | 'map'
    value: any
}

function tryPretty(json: string): string {
    try { return JSON.stringify(JSON.parse(json), null, 2) } catch { return json }
}

function objectToRows(obj: Record<string, unknown>): KeyValueRow[] {
    return Object.entries(obj).map(([key, val]) => {
        let type: KeyValueRow['type'] = 'string'
        let value: any = val
        if (val === null) {
            type = 'null'
            value = null
        } else if (typeof val === 'boolean') {
            type = 'boolean'
            value = val
        } else if (typeof val === 'number') {
            type = 'number'
            value = String(val)
        } else if (Array.isArray(val)) {
            type = 'list'
            value = JSON.stringify(val)
        } else if (typeof val === 'object') {
            type = 'map'
            value = JSON.stringify(val)
        } else {
            type = 'string'
            value = String(val)
        }
        return { key, type, value }
    })
}

function rowsToObject(rows: KeyValueRow[]): Record<string, unknown> {
    const obj: Record<string, unknown> = {}
    rows.forEach(row => {
        if (!row.key) return
        let parsedVal: any = row.value
        if (row.type === 'number') {
            const num = Number(row.value)
            parsedVal = isNaN(num) ? row.value : num
        } else if (row.type === 'boolean') {
            parsedVal = row.value === true || row.value === 'true'
        } else if (row.type === 'null') {
            parsedVal = null
        } else if (row.type === 'list' || row.type === 'map') {
            try {
                parsedVal = JSON.parse(row.value)
            } catch {
                parsedVal = row.value
            }
        }
        obj[row.key] = parsedVal
    })
    return obj
}

export default function ItemEditor({ open, item, onClose, onSaved }: Props) {
    const { selectedTable, queryResults, scanResults, setQueryResults, setScanResults } = useAppStore()
    const { message } = AntApp.useApp()
    const [json, setJson] = useState('')
    const [jsonError, setJsonError] = useState('')
    const [saving, setSaving] = useState(false)
    const [rows, setRows] = useState<KeyValueRow[]>([])
    const [activeTabKey, setActiveTabKey] = useState('kv')
    const isNew = item === null

    useEffect(() => {
        if (open) {
            const initialObj = item ? item : { id: '' }
            setJson(JSON.stringify(initialObj, null, 2))
            setRows(objectToRows(initialObj))
            setJsonError('')
            setActiveTabKey('kv')
        }
    }, [open, item])

    const handleJsonChange = (val: string) => {
        setJson(val)
        try {
            const parsed = JSON.parse(val)
            setJsonError('')
            setRows(objectToRows(parsed))
        } catch (e) {
            setJsonError((e as Error).message)
        }
    }

    const handleRowsChange = (newRows: KeyValueRow[]) => {
        setRows(newRows)
        const obj = rowsToObject(newRows)
        setJson(JSON.stringify(obj, null, 2))
        setJsonError('')
    }

    const validate = (val: string) => {
        try { JSON.parse(val); setJsonError(''); return true }
        catch (e) { setJsonError((e as Error).message); return false }
    }

    const handleSave = async () => {
        if (!selectedTable) return
        if (!validate(json)) return

        setSaving(true)
        const parsed = JSON.parse(json) as Record<string, unknown>

        const res = await window.api.items.put({ tableName: selectedTable, item: parsed })
        setSaving(false)

        if (res.success) {
            message.success(isNew ? 'Item created' : 'Item saved')
            // Update local results to reflect edit
            if (!isNew && item) {
                const update = (arr: Record<string, unknown>[]) =>
                    arr.map(r => r === item ? parsed : r)
                setQueryResults(update(queryResults))
                setScanResults(update(scanResults))
            }
            onSaved()
        } else {
            message.error(res.error ?? 'Save failed')
        }
    }

    const handleAddRow = () => {
        const newRows = [...rows, { key: '', type: 'string' as const, value: '' }]
        handleRowsChange(newRows)
    }

    const handleUpdateRow = (index: number, patch: Partial<KeyValueRow>) => {
        const newRows = rows.map((r, i) => {
            if (i !== index) return r
            const updated = { ...r, ...patch }
            if (patch.type) {
                if (patch.type === 'boolean') updated.value = true
                else if (patch.type === 'null') updated.value = null
                else if (patch.type === 'list') updated.value = '[]'
                else if (patch.type === 'map') updated.value = '{}'
                else updated.value = ''
            }
            return updated
        })
        handleRowsChange(newRows)
    }

    const handleDeleteRow = (index: number) => {
        const newRows = rows.filter((_, i) => i !== index)
        handleRowsChange(newRows)
    }

    const tabItems = [
        {
            key: 'kv',
            label: 'Form Editor',
            children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: 4 }}>
                        {rows.map((row, i) => (
                            <Space key={i} style={{ display: 'flex', width: '100%', marginBottom: 12, alignItems: 'flex-start' }} align="baseline">
                                <Input
                                    placeholder="Attribute Name"
                                    value={row.key}
                                    onChange={e => handleUpdateRow(i, { key: e.target.value })}
                                    style={{ width: 140 }}
                                />
                                <Select
                                    value={row.type}
                                    onChange={v => handleUpdateRow(i, { type: v })}
                                    style={{ width: 100 }}
                                >
                                    <Option value="string">String</Option>
                                    <Option value="number">Number</Option>
                                    <Option value="boolean">Boolean</Option>
                                    <Option value="null">Null</Option>
                                    <Option value="list">List</Option>
                                    <Option value="map">Map</Option>
                                </Select>
                                <div style={{ flex: 1, minWidth: 150 }}>
                                    {row.type === 'boolean' && (
                                        <Select
                                            value={row.value}
                                            onChange={v => handleUpdateRow(i, { value: v })}
                                            style={{ width: '100%' }}
                                        >
                                            <Option value={true}>true</Option>
                                            <Option value={false}>false</Option>
                                        </Select>
                                    )}
                                    {row.type === 'null' && (
                                        <Input value="null" disabled style={{ width: '100%' }} />
                                    )}
                                    {row.type !== 'boolean' && row.type !== 'null' && (
                                        <Input
                                            placeholder={row.type === 'list' ? 'JSON Array: [1, 2]' : row.type === 'map' ? 'JSON Object: {"a": 1}' : 'Value'}
                                            value={row.value}
                                            onChange={e => handleUpdateRow(i, { value: e.target.value })}
                                            style={{ width: '100%' }}
                                        />
                                    )}
                                </div>
                                <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => handleDeleteRow(i)}
                                />
                            </Space>
                        ))}
                    </div>
                    <Button
                        type="dashed"
                        onClick={handleAddRow}
                        icon={<PlusOutlined />}
                        block
                    >
                        Add Attribute
                    </Button>
                </div>
            )
        },
        {
            key: 'json',
            label: 'JSON Editor',
            children: (
                <div>
                    {jsonError && (
                        <Alert
                            type="error"
                            message={jsonError}
                            showIcon
                            style={{ marginBottom: 8, fontSize: 12 }}
                        />
                    )}
                    <textarea
                        className="item-editor-textarea"
                        value={json}
                        onChange={e => handleJsonChange(e.target.value)}
                        rows={24}
                        spellCheck={false}
                        style={{
                            width: '100%',
                            resize: 'vertical',
                            background: 'var(--color-surface-2)',
                            border: `1px solid ${jsonError ? 'var(--color-accent)' : 'var(--color-border)'}`,
                            borderRadius: 'var(--radius-md)',
                            padding: 12,
                            color: 'var(--color-text-primary)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 13,
                            lineHeight: 1.6,
                            outline: 'none'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <Button
                            size="small"
                            onClick={() => setJson(tryPretty(json))}
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            Format JSON
                        </Button>
                    </div>
                </div>
            )
        }
    ]

    return (
        <Drawer
            title={
                <Space>
                    <Text style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                        {isNew ? 'New Item' : 'Edit Item'}
                    </Text>
                    {selectedTable && (
                        <Text style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 400 }}>
                            {selectedTable}
                        </Text>
                    )}
                </Space>
            }
            placement="right"
            width={560}
            open={open}
            onClose={onClose}
            resizable
            extra={
                <Space>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={handleSave}
                        loading={saving}
                        disabled={!!jsonError}
                    >
                        {isNew ? 'Create Item' : 'Save Changes'}
                    </Button>
                </Space>
            }
        >
            <Tabs
                activeKey={activeTabKey}
                onChange={setActiveTabKey}
                items={tabItems}
                size="small"
            />
        </Drawer>
    )
}
