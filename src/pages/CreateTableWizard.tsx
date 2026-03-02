import { useState } from 'react'
import {
    Modal, Steps, Form, Input, Select, Button, Space,
    InputNumber, Switch, Typography, App as AntApp
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'

const { Text } = Typography
const { Option } = Select

interface AttributeDef {
    name: string
    type: 'S' | 'N' | 'B'
}

interface KeySchema {
    partitionKey: string
    sortKey?: string
}

interface Props {
    open: boolean
    onClose: () => void
    onCreated: (tableName: string) => void
}

export default function CreateTableWizard({ open, onClose, onCreated }: Props) {
    const { message } = AntApp.useApp()
    const [current, setCurrent] = useState(0)
    const [loading, setLoading] = useState(false)

    // Step 1 – basics
    const [tableName, setTableName] = useState('')
    const [attrs, setAttrs] = useState<AttributeDef[]>([
        { name: '', type: 'S' },
        { name: '', type: 'S' }
    ])
    const [keySchema, setKeySchema] = useState<KeySchema>({ partitionKey: '', sortKey: undefined })
    const [hasSortKey, setHasSortKey] = useState(false)

    // Step 2 – capacity
    const [billingMode, setBillingMode] = useState<'PAY_PER_REQUEST' | 'PROVISIONED'>('PAY_PER_REQUEST')
    const [rcu, setRcu] = useState(5)
    const [wcu, setWcu] = useState(5)

    const handleCreate = async () => {
        if (!tableName) { message.error('Table name is required'); return }
        if (!keySchema.partitionKey) { message.error('Partition key is required'); return }

        const usedAttrs = attrs.filter(a => a.name === keySchema.partitionKey || (hasSortKey && a.name === keySchema.sortKey))

        setLoading(true)
        const res = await window.api.tables.create({
            TableName: tableName,
            AttributeDefinitions: usedAttrs.map(a => ({
                AttributeName: a.name,
                AttributeType: a.type
            })),
            KeySchema: [
                { AttributeName: keySchema.partitionKey, KeyType: 'HASH' },
                ...(hasSortKey && keySchema.sortKey ? [{ AttributeName: keySchema.sortKey, KeyType: 'RANGE' }] : [])
            ],
            BillingMode: billingMode,
            ...(billingMode === 'PROVISIONED' ? {
                ProvisionedThroughput: { ReadCapacityUnits: rcu, WriteCapacityUnits: wcu }
            } : {})
        })
        setLoading(false)

        if (res.success) {
            message.success(`Table "${tableName}" created successfully`)
            onCreated(tableName)
            resetState()
        } else {
            message.error(res.error ?? 'Failed to create table')
        }
    }

    const resetState = () => {
        setCurrent(0)
        setTableName('')
        setAttrs([{ name: '', type: 'S' }, { name: '', type: 'S' }])
        setKeySchema({ partitionKey: '', sortKey: undefined })
        setHasSortKey(false)
        setBillingMode('PAY_PER_REQUEST')
        setRcu(5)
        setWcu(5)
    }

    const steps = [
        {
            title: 'Table Settings',
            content: (
                <Form layout="vertical" requiredMark={false}>
                    <Form.Item label="Table Name" required>
                        <Input
                            placeholder="e.g. Users"
                            value={tableName}
                            onChange={e => setTableName(e.target.value)}
                        />
                    </Form.Item>

                    <Form.Item label="Attributes">
                        <Space direction="vertical" style={{ width: '100%' }}>
                            {attrs.map((attr, i) => (
                                <Space key={i} style={{ width: '100%' }}>
                                    <Input
                                        placeholder="Attribute name"
                                        value={attr.name}
                                        onChange={e => {
                                            const next = [...attrs]
                                            next[i] = { ...next[i], name: e.target.value }
                                            setAttrs(next)
                                        }}
                                        style={{ width: 200 }}
                                    />
                                    <Select
                                        value={attr.type}
                                        onChange={v => {
                                            const next = [...attrs]
                                            next[i] = { ...next[i], type: v }
                                            setAttrs(next)
                                        }}
                                        style={{ width: 120 }}
                                    >
                                        <Option value="S">String (S)</Option>
                                        <Option value="N">Number (N)</Option>
                                        <Option value="B">Binary (B)</Option>
                                    </Select>
                                    {attrs.length > 1 && (
                                        <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => setAttrs(attrs.filter((_, j) => j !== i))}
                                        />
                                    )}
                                </Space>
                            ))}
                            <Button
                                type="dashed"
                                icon={<PlusOutlined />}
                                onClick={() => setAttrs([...attrs, { name: '', type: 'S' }])}
                                block
                            >
                                Add attribute
                            </Button>
                        </Space>
                    </Form.Item>

                    <Form.Item label="Partition Key (Hash)" required>
                        <Select
                            placeholder="Select attribute"
                            value={keySchema.partitionKey || undefined}
                            onChange={v => setKeySchema(k => ({ ...k, partitionKey: v }))}
                        >
                            {attrs.filter(a => a.name).map(a => (
                                <Option key={a.name} value={a.name}>{a.name} ({a.type})</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item label={
                        <Space>
                            Sort Key (Range)
                            <Switch size="small" checked={hasSortKey} onChange={setHasSortKey} />
                        </Space>
                    }>
                        {hasSortKey && (
                            <Select
                                placeholder="Select attribute"
                                value={keySchema.sortKey || undefined}
                                onChange={v => setKeySchema(k => ({ ...k, sortKey: v }))}
                            >
                                {attrs.filter(a => a.name && a.name !== keySchema.partitionKey).map(a => (
                                    <Option key={a.name} value={a.name}>{a.name} ({a.type})</Option>
                                ))}
                            </Select>
                        )}
                    </Form.Item>
                </Form>
            )
        },
        {
            title: 'Capacity',
            content: (
                <Form layout="vertical" requiredMark={false}>
                    <Form.Item label="Billing Mode">
                        <Select
                            value={billingMode}
                            onChange={v => setBillingMode(v)}
                        >
                            <Option value="PAY_PER_REQUEST">On-Demand (Pay per request)</Option>
                            <Option value="PROVISIONED">Provisioned</Option>
                        </Select>
                    </Form.Item>

                    {billingMode === 'PROVISIONED' && (
                        <Space>
                            <Form.Item label="Read Capacity Units">
                                <InputNumber min={1} value={rcu} onChange={v => setRcu(v ?? 1)} />
                            </Form.Item>
                            <Form.Item label="Write Capacity Units">
                                <InputNumber min={1} value={wcu} onChange={v => setWcu(v ?? 1)} />
                            </Form.Item>
                        </Space>
                    )}

                    <div style={{
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: 16,
                        marginTop: 8
                    }}>
                        <Text style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                            <strong>Summary</strong><br />
                            Table: <code>{tableName || '—'}</code><br />
                            Partition key: <code>{keySchema.partitionKey || '—'}</code>
                            {hasSortKey && keySchema.sortKey && <>, Sort key: <code>{keySchema.sortKey}</code></>}<br />
                            Billing: {billingMode === 'PAY_PER_REQUEST' ? 'On-Demand' : `Provisioned (${rcu} RCU / ${wcu} WCU)`}
                        </Text>
                    </div>
                </Form>
            )
        }
    ]

    return (
        <Modal
            open={open}
            title="Create Table"
            onCancel={() => { onClose(); resetState() }}
            footer={null}
            width={560}
        >
            <Steps
                current={current}
                size="small"
                style={{ marginBottom: 24 }}
                items={steps.map(s => ({ title: s.title }))}
            />

            <div style={{ minHeight: 320 }}>
                {steps[current].content}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                {current > 0 && (
                    <Button onClick={() => setCurrent(c => c - 1)}>Back</Button>
                )}
                {current < steps.length - 1 && (
                    <Button type="primary" onClick={() => setCurrent(c => c + 1)}>
                        Next →
                    </Button>
                )}
                {current === steps.length - 1 && (
                    <Button type="primary" loading={loading} onClick={handleCreate}>
                        Create Table
                    </Button>
                )}
            </div>
        </Modal>
    )
}
