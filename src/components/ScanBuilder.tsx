import { useState, useCallback } from 'react'
import {
    Form, Input, Select, Button, Space,
    InputNumber, Divider, Typography, Tooltip, App as AntApp
} from 'antd'
import { PlayCircleOutlined, PlusOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons'
import { useAppStore } from '../store/appStore'
import type { TableDescription } from '../types/global'

const { Text } = Typography
const { Option } = Select

const FILTER_OPS = ['=', '<>', '<', '<=', '>', '>=', 'begins_with', 'contains', 'attribute_exists', 'attribute_not_exists']

interface FilterRow {
    attr: string
    op: string
    val: string
}

function buildFilter(filters: FilterRow[], attrNames: Record<string, string>, attrValues: Record<string, unknown>) {
    const parts: string[] = []
    filters.forEach((f, i) => {
        if (!f.attr) return
        const nKey = `#sattr${i}`
        const vKey = `:sval${i}`
        attrNames[nKey] = f.attr
        if (f.op === 'attribute_exists' || f.op === 'attribute_not_exists') {
            parts.push(`${f.op}(${nKey})`)
        } else if (f.op === 'begins_with' || f.op === 'contains') {
            attrValues[vKey] = f.val
            parts.push(`${f.op}(${nKey}, ${vKey})`)
        } else {
            attrValues[vKey] = f.val
            parts.push(`${nKey} ${f.op} ${vKey}`)
        }
    })
    return parts.join(' AND ')
}

interface Props {
    table: TableDescription
}

export default function ScanBuilder({ table }: Props) {
    const { selectedTable, setScanResults, appendScanResults, lastEvaluatedKey } = useAppStore()
    const { message } = AntApp.useApp()
    const [loading, setLoading] = useState(false)

    const allIndexes = [
        ...(table.GlobalSecondaryIndexes ?? []),
        ...(table.LocalSecondaryIndexes ?? [])
    ] as Array<{ IndexName?: string }>

    const [indexName, setIndexName] = useState<string | undefined>(undefined)
    const [limit, setLimit] = useState<number | null>(50)
    const [filters, setFilters] = useState<FilterRow[]>([])

    const addFilter = () => setFilters(f => [...f, { attr: '', op: '=', val: '' }])
    const removeFilter = (i: number) => setFilters(f => f.filter((_, j) => j !== i))
    const updateFilter = (i: number, patch: Partial<FilterRow>) =>
        setFilters(f => f.map((r, j) => j === i ? { ...r, ...patch } : r))

    const run = useCallback(async (loadMore = false) => {
        if (!selectedTable) return
        setLoading(true)

        const attrNames: Record<string, string> = {}
        const attrValues: Record<string, unknown> = {}
        const filterExpr = buildFilter(filters, attrNames, attrValues)

        const res = await window.api.query.scan({
            tableName: selectedTable,
            indexName,
            filterExpression: filterExpr || undefined,
            expressionAttributeNames: Object.keys(attrNames).length ? attrNames : undefined,
            expressionAttributeValues: Object.keys(attrValues).length ? attrValues : undefined,
            limit: limit ?? undefined,
            exclusiveStartKey: loadMore ? lastEvaluatedKey : undefined
        })

        setLoading(false)
        if (res.success) {
            const items = res.items as Record<string, unknown>[] ?? []
            if (loadMore) appendScanResults(items, res.lastEvaluatedKey)
            else setScanResults(items, res.lastEvaluatedKey)
            message.success(`${res.count} item(s) returned (scanned: ${res.scannedCount})`)
        } else {
            message.error(res.error ?? 'Scan failed')
        }
    }, [selectedTable, indexName, filters, limit, lastEvaluatedKey, setScanResults, appendScanResults, message])

    const exportResults = () => {
        const { scanResults } = useAppStore.getState()
        const blob = new Blob([JSON.stringify(scanResults, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${selectedTable}-scan.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div style={{ padding: '16px 20px' }}>
            <Space wrap style={{ marginBottom: 12 }} size={8}>
                {allIndexes.length > 0 && (
                    <Form.Item label={<Text style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>Index</Text>} style={{ margin: 0 }}>
                        <Select
                            placeholder="Table (default)"
                            value={indexName}
                            onChange={setIndexName}
                            allowClear
                            style={{ width: 200 }}
                            size="small"
                        >
                            {allIndexes.map(idx => (
                                <Option key={idx.IndexName} value={idx.IndexName}>{idx.IndexName}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                )}
                <Form.Item label={<Text style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>Limit</Text>} style={{ margin: 0 }}>
                    <InputNumber min={1} max={1000} value={limit} onChange={setLimit} size="small" style={{ width: 80 }} />
                </Form.Item>
            </Space>

            {filters.length > 0 && (
                <div style={{
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    marginBottom: 12
                }}>
                    <Text style={{ color: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Filter Expression
                    </Text>
                    <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size={6}>
                        {filters.map((f, i) => (
                            <Space key={i} size={6} wrap>
                                <Input
                                    placeholder="Attribute"
                                    value={f.attr}
                                    onChange={e => updateFilter(i, { attr: e.target.value })}
                                    size="small"
                                    style={{ width: 140 }}
                                />
                                <Select value={f.op} onChange={v => updateFilter(i, { op: v })} size="small" style={{ width: 140 }}>
                                    {FILTER_OPS.map(op => <Option key={op} value={op}>{op}</Option>)}
                                </Select>
                                {f.op !== 'attribute_exists' && f.op !== 'attribute_not_exists' && (
                                    <Input
                                        placeholder="Value"
                                        value={f.val}
                                        onChange={e => updateFilter(i, { val: e.target.value })}
                                        size="small"
                                        style={{ width: 140 }}
                                    />
                                )}
                                <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => removeFilter(i)} />
                            </Space>
                        ))}
                    </Space>
                </div>
            )}

            <Divider style={{ borderColor: 'var(--color-border)', margin: '12px 0' }} />
            <Space wrap>
                <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => run(false)}
                    loading={loading}
                    size="small"
                >
                    Run Scan
                </Button>
                <Button icon={<PlusOutlined />} size="small" onClick={addFilter}>
                    Add Filter
                </Button>
                {lastEvaluatedKey && (
                    <Button size="small" onClick={() => run(true)} loading={loading}>
                        Load More
                    </Button>
                )}
                <Tooltip title="Export results as JSON">
                    <Button icon={<DownloadOutlined />} size="small" onClick={exportResults}>
                        Export
                    </Button>
                </Tooltip>
            </Space>
        </div>
    )
}
