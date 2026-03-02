import { useState, useEffect } from 'react'
import { Drawer, Button, Space, Tabs, Typography, App as AntApp, Alert } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useAppStore } from '../store/appStore'

const { Text } = Typography

interface Props {
    open: boolean
    item: Record<string, unknown> | null
    onClose: () => void
    onSaved: () => void
}

function tryPretty(json: string): string {
    try { return JSON.stringify(JSON.parse(json), null, 2) } catch { return json }
}

export default function ItemEditor({ open, item, onClose, onSaved }: Props) {
    const { selectedTable, queryResults, scanResults, setQueryResults, setScanResults } = useAppStore()
    const { message } = AntApp.useApp()
    const [json, setJson] = useState('')
    const [jsonError, setJsonError] = useState('')
    const [saving, setSaving] = useState(false)
    const isNew = item === null

    useEffect(() => {
        if (open) {
            setJson(item ? JSON.stringify(item, null, 2) : '{\n  \n}')
            setJsonError('')
        }
    }, [open, item])

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

    const tabItems = [
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
                        onChange={e => { setJson(e.target.value); validate(e.target.value) }}
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
            <Tabs items={tabItems} size="small" />
        </Drawer>
    )
}
