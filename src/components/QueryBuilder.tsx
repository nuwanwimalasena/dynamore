import { useState, useCallback } from 'react'
import {
    Form, Input, Select, Button, Space, InputNumber,
    Divider, Typography, Tooltip, App as AntApp
} from 'antd'
import { PlayCircleOutlined, PlusOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons'
import { useAppStore } from '../store/appStore'
import type { TableDescription } from '../types/global'

const { Text } = Typography
const { Option } = Select

const CONDITION_OPS = ['=', '<', '<=', '>', '>=', 'BETWEEN', 'begins_with']
const FILTER_OPS = ['=', '<>', '<', '<=', '>', '>=', 'begins_with', 'contains', 'attribute_exists', 'attribute_not_exists']

interface FilterRow {
    attr: string
    op: string
    val: string
    val2?: string
}

function buildExpression(filters: FilterRow[], attrNames: Record<string, string>, attrValues: Record<string, unknown>, prefix: string) {
    const parts: string[] = []
    filters.forEach((f, i) => {
        if (!f.attr) return
        const nKey = `#${prefix}attr${i}`
        const vKey = `:${prefix}val${i}`
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

export default function QueryBuilder({ table }: Props) {
    const { setQueryResults, appendQueryResults, lastEvaluatedKey, selectedTable } = useAppStore()
    const { message } = AntApp.useApp()
    const [loading, setLoading] = useState(false)

    // Index selection
    const allIndexes = [
        ...(table.GlobalSecondaryIndexes ?? []),
        ...(table.LocalSecondaryIndexes ?? [])
    ] as Array<{ IndexName?: string; KeySchema?: Array<{ AttributeName: string; KeyType: string }> }>

    const [indexName, setIndexName] = useState<string | undefined>(undefined)
    const [pkVal, setPkVal] = useState('')
    const [skOp, setSkOp] = useState('=')
    const [skVal, setSkVal] = useState('')
    const [skVal2, setSkVal2] = useState('')
    const [sortAsc, setSortAsc] = useState(true)
    const [limit, setLimit] = useState<number | null>(50)
    const [filters, setFilters] = useState<FilterRow[]>([])

    // Determine key schema from selected index or table
    const activeSchema = indexName
        ? (allIndexes.find(i => i.IndexName === indexName)?.KeySchema ?? [])
        : (table.KeySchema ?? [])
    const pkAttr = activeSchema.find(k => k.KeyType === 'HASH')?.AttributeName ?? ''
    const skAttr = activeSchema.find(k => k.KeyType === 'RANGE')?.AttributeName ?? ''

    const addFilter = () => setFilters(f => [...f, { attr: '', op: '=', val: '' }])
    const removeFilter = (i: number) => setFilters(f => f.filter((_, j) => j !== i))
    const updateFilter = (i: number, patch: Partial<FilterRow>) =>
        setFilters(f => f.map((r, j) => j === i ? { ...r, ...patch } : r))

    const run = useCallback(async (loadMore = false) => {
        if (!selectedTable || !pkVal) { message.warning('Partition key value is required'); return }
        setLoading(true)

        const attrNames: Record<string, string> = { '#pk': pkAttr }
        const attrValues: Record<string, unknown> = { ':pkval': pkVal }

        let kce = '#pk = :pkval'
        if (skAttr && skVal) {
            attrNames['#sk'] = skAttr
            if (skOp === 'BETWEEN') {
                attrValues[':skval'] = skVal
                attrValues[':skval2'] = skVal2
                kce += ' AND #sk BETWEEN :skval AND :skval2'
            } else if (skOp === 'begins_with') {
                attrValues[':skval'] = skVal
                kce += ' AND begins_with(#sk, :skval)'
            } else {
                attrValues[':skval'] = skVal
                kce += ` AND #sk ${skOp} :skval`
            }
        }

        const filterExpr = buildExpression(filters, attrNames, attrValues, 'f')

        const res = await window.api.query.query({
            tableName: selectedTable,
            indexName,
            keyConditionExpression: kce,
            filterExpression: filterExpr || undefined,
            expressionAttributeNames: Object.keys(attrNames).length ? attrNames : undefined,
            expressionAttributeValues: Object.keys(attrValues).length ? attrValues : undefined,
            limit: limit ?? undefined,
            exclusiveStartKey: loadMore ? lastEvaluatedKey : undefined,
            scanIndexForward: sortAsc
        })

        setLoading(false)
        if (res.success) {
            const items = res.items as Record<string, unknown>[] ?? []
            if (loadMore) appendQueryResults(items, res.lastEvaluatedKey)
            else setQueryResults(items, res.lastEvaluatedKey)
            message.success(`${res.count} item(s) returned (scanned: ${res.scannedCount})`)
        } else {
            message.error(res.error ?? 'Query failed')
        }
    }, [selectedTable, pkVal, pkAttr, skAttr, skVal, skOp, skVal2, filters, limit, sortAsc, indexName, lastEvaluatedKey, setQueryResults, appendQueryResults, message])

    const exportResults = () => {
        const { queryResults } = useAppStore.getState()
        const blob = new Blob([JSON.stringify(queryResults, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${selectedTable}-query.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div style={{ padding: '16px 20px' }}>
            <Space wrap style={{ width: '100%', marginBottom: 12 }} size={8}>
                {/* Index selector */}
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

                {/* Sort direction */}
                <Form.Item label={<Text style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>Sort</Text>} style={{ margin: 0 }}>
                    <Select value={sortAsc ? 'asc' : 'desc'} onChange={v => setSortAsc(v === 'asc')} style={{ width: 110 }} size="small">
                        <Option value="asc">Ascending</Option>
                        <Option value="desc">Descending</Option>
                    </Select>
                </Form.Item>

                {/* Limit */}
                <Form.Item label={<Text style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>Limit</Text>} style={{ margin: 0 }}>
                    <InputNumber
                        min={1}
                        max={1000}
                        value={limit}
                        onChange={setLimit}
                        size="small"
                        style={{ width: 80 }}
                        placeholder="50"
                    />
                </Form.Item>
            </Space>

            {/* Key condition */}
            <div style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 12
            }}>
                <Text style={{ color: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Key Condition
                </Text>
                <Space style={{ marginTop: 8, width: '100%', flexWrap: 'wrap' }} size={8}>
                    <Input
                        addonBefore={<code style={{ fontSize: 11 }}>{pkAttr || 'pk'}</code>}
                        placeholder="Partition key value"
                        value={pkVal}
                        onChange={e => setPkVal(e.target.value)}
                        size="small"
                        style={{ width: 260 }}
                    />
                    {skAttr && (
                        <>
                            <Select value={skOp} onChange={setSkOp} size="small" style={{ width: 130 }}>
                                {CONDITION_OPS.map(op => <Option key={op} value={op}>{op}</Option>)}
                            </Select>
                            <Input
                                addonBefore={<code style={{ fontSize: 11 }}>{skAttr}</code>}
                                placeholder="Sort key value"
                                value={skVal}
                                onChange={e => setSkVal(e.target.value)}
                                size="small"
                                style={{ width: 220 }}
                            />
                            {skOp === 'BETWEEN' && (
                                <Input
                                    placeholder="and value"
                                    value={skVal2}
                                    onChange={e => setSkVal2(e.target.value)}
                                    size="small"
                                    style={{ width: 140 }}
                                />
                            )}
                        </>
                    )}
                </Space>
            </div>

            {/* Filter expressions */}
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

            {/* Actions */}
            <Divider style={{ borderColor: 'var(--color-border)', margin: '12px 0' }} />
            <Space wrap>
                <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => run(false)}
                    loading={loading}
                    size="small"
                >
                    Run Query
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
