import { useState, useCallback, useMemo } from 'react'
import {
    Form, Input, Select, Button, Space,
    InputNumber, Divider, Typography, Tooltip, App as AntApp, AutoComplete
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

function parseAttrVal(val: string, attrType?: string): unknown {
    if (attrType === 'N' || (!attrType && !isNaN(Number(val)) && val.trim() !== '')) {
        return Number(val)
    }
    if (attrType === 'BOOL' || val === 'true' || val === 'false') {
        if (val === 'true') return true
        if (val === 'false') return false
    }
    return val
}

function buildFilter(
    filters: FilterRow[],
    attrNames: Record<string, string>,
    attrValues: Record<string, unknown>,
    attrTypes: Record<string, string>
) {
    const parts: string[] = []
    filters.forEach((f, i) => {
        if (!f.attr) return
        const nKey = `#sattr${i}`
        const vKey = `:sval${i}`
        attrNames[nKey] = f.attr

        const parsedVal = parseAttrVal(f.val, attrTypes[f.attr])

        if (f.op === 'attribute_exists' || f.op === 'attribute_not_exists') {
            parts.push(`${f.op}(${nKey})`)
        } else if (f.op === 'begins_with' || f.op === 'contains') {
            attrValues[vKey] = f.val
            parts.push(`${f.op}(${nKey}, ${vKey})`)
        } else {
            attrValues[vKey] = parsedVal
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

    // Normalize schema items
    const tableKeySchema = useMemo(() => {
        const raw = (table as any).keySchema ?? (table as any).KeySchema ?? []
        return (raw as any[]).map(k => ({
            attributeName: k.attributeName ?? k.AttributeName ?? k.attribute_name ?? '',
            keyType: (k.keyType ?? k.KeyType ?? k.key_type ?? '').toUpperCase()
        }))
    }, [table])

    const tableAttrDefs = useMemo(() => {
        const raw = (table as any).attributeDefinitions ?? (table as any).AttributeDefinitions ?? []
        return (raw as any[]).map(a => ({
            attributeName: a.attributeName ?? a.AttributeName ?? a.attribute_name ?? '',
            attributeType: (a.attributeType ?? a.AttributeType ?? a.attribute_type ?? 'S').toUpperCase()
        }))
    }, [table])

    const attrTypeMap = useMemo(() => {
        const map: Record<string, string> = {}
        for (const def of tableAttrDefs) {
            if (def.attributeName) {
                map[def.attributeName] = def.attributeType
            }
        }
        return map
    }, [tableAttrDefs])

    const allIndexes = useMemo(() => {
        const rawGsi = (table as any).globalSecondaryIndexes ?? (table as any).GlobalSecondaryIndexes ?? []
        const rawLsi = (table as any).localSecondaryIndexes ?? (table as any).LocalSecondaryIndexes ?? []
        return [
            ...rawGsi.map((idx: any) => ({
                indexName: idx.indexName ?? idx.IndexName ?? '',
                keySchema: ((idx.keySchema ?? idx.KeySchema ?? []) as any[]).map(k => ({
                    attributeName: k.attributeName ?? k.AttributeName ?? k.attribute_name ?? '',
                    keyType: (k.keyType ?? k.KeyType ?? k.key_type ?? '').toUpperCase()
                }))
            })),
            ...rawLsi.map((idx: any) => ({
                indexName: idx.indexName ?? idx.IndexName ?? '',
                keySchema: ((idx.keySchema ?? idx.KeySchema ?? []) as any[]).map(k => ({
                    attributeName: k.attributeName ?? k.AttributeName ?? k.attribute_name ?? '',
                    keyType: (k.keyType ?? k.KeyType ?? k.key_type ?? '').toUpperCase()
                }))
            }))
        ].filter(idx => Boolean(idx.indexName))
    }, [table])

    const [indexName, setIndexName] = useState<string | undefined>(undefined)
    const [limit, setLimit] = useState<number | null>(50)
    const [filters, setFilters] = useState<FilterRow[]>([])
    const [selectedFields, setSelectedFields] = useState<string[]>([])

    const knownAttributes = useMemo(() => Array.from(
        new Set([
            ...tableKeySchema.map(k => k.attributeName),
            ...tableAttrDefs.map(a => a.attributeName),
            ...allIndexes.flatMap(idx => idx.keySchema.map(k => k.attributeName))
        ])
    ).filter(Boolean), [tableKeySchema, tableAttrDefs, allIndexes])

    const addFilter = () => setFilters(f => [...f, { attr: '', op: '=', val: '' }])
    const removeFilter = (i: number) => setFilters(f => f.filter((_, j) => j !== i))
    const updateFilter = (i: number, patch: Partial<FilterRow>) =>
        setFilters(f => f.map((r, j) => j === i ? { ...r, ...patch } : r))

    const run = useCallback(async (loadMore = false) => {
        if (!selectedTable) return
        setLoading(true)

        const attrNames: Record<string, string> = {}
        const attrValues: Record<string, unknown> = {}
        const filterExpr = buildFilter(filters, attrNames, attrValues, attrTypeMap)

        let projectionExpr: string | undefined = undefined
        if (selectedFields && selectedFields.length > 0) {
            const projParts = selectedFields.map((field, idx) => {
                const key = `#p_attr${idx}`
                attrNames[key] = field
                return key
            })
            projectionExpr = projParts.join(', ')
        }

        const params: any = {
            tableName: selectedTable,
            indexName,
            limit: limit ?? undefined,
            exclusiveStartKey: loadMore ? lastEvaluatedKey : undefined
        }
        if (filterExpr) params.filterExpression = filterExpr
        if (projectionExpr) params.projectionExpression = projectionExpr
        if (Object.keys(attrNames).length > 0) params.expressionAttributeNames = attrNames
        if (Object.keys(attrValues).length > 0) params.expressionAttributeValues = attrValues

        try {
            const res = await window.api.query.scan(params)
            if (res && res.success !== false) {
                const items = (res.items as Record<string, unknown>[]) ?? []
                if (loadMore) appendScanResults(items, res.lastEvaluatedKey)
                else setScanResults(items, res.lastEvaluatedKey)
                message.success(`${res.count ?? items.length} item(s) returned (scanned: ${res.scannedCount ?? items.length})`)
            } else {
                message.error(res?.error ?? 'Scan failed')
            }
        } catch (err: any) {
            message.error(typeof err === 'string' ? err : err?.message ?? 'Scan failed')
        } finally {
            setLoading(false)
        }
    }, [selectedTable, indexName, filters, limit, lastEvaluatedKey, setScanResults, appendScanResults, message, selectedFields, attrTypeMap])

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
                                <Option key={idx.indexName} value={idx.indexName}>{idx.indexName}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                )}
                <Form.Item label={<Text style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>Limit</Text>} style={{ margin: 0 }}>
                    <InputNumber min={1} max={1000} value={limit} onChange={setLimit} size="small" style={{ width: 80 }} />
                </Form.Item>

                {/* Fields */}
                <Form.Item label={<Text style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>Fields</Text>} style={{ margin: 0 }}>
                    <Select
                        mode="tags"
                        placeholder="All attributes"
                        value={selectedFields}
                        onChange={setSelectedFields}
                        style={{ minWidth: 200, maxWidth: 350 }}
                        size="small"
                        allowClear
                        maxTagCount="responsive"
                    >
                        {knownAttributes.map(attr => (
                            <Option key={attr} value={attr}>{attr}</Option>
                        ))}
                    </Select>
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
                                <AutoComplete
                                    placeholder="Attribute"
                                    value={f.attr}
                                    options={knownAttributes.map(a => ({ value: a }))}
                                    onChange={val => updateFilter(i, { attr: val })}
                                    size="small"
                                    style={{ width: 150 }}
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
                {lastEvaluatedKey && (
                    <Button
                        onClick={() => run(true)}
                        loading={loading}
                        size="small"
                    >
                        Load More
                    </Button>
                )}
                <Button
                    icon={<PlusOutlined />}
                    onClick={addFilter}
                    size="small"
                >
                    Add Filter
                </Button>
                <Button
                    icon={<DownloadOutlined />}
                    onClick={exportResults}
                    size="small"
                >
                    Export JSON
                </Button>
            </Space>
        </div>
    )
}
