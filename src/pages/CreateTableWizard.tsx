import { useState } from 'react'
import {
    Modal, Steps, Form, Input, Select, Button, Space,
    InputNumber, Switch, Typography, App as AntApp, Card
} from 'antd'
import { DatabaseOutlined, KeyOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { CreateTableRequest, ScalarType, BillingMode } from '../types/dynamo'

const { Text, Title } = Typography
const { Option } = Select

interface Props {
    open: boolean
    onClose: () => void
    onCreated: (tableName: string) => void
}

export default function CreateTableWizard({ open, onClose, onCreated }: Props) {
    const { message } = AntApp.useApp()
    const [current, setCurrent] = useState(0)
    const [loading, setLoading] = useState(false)

    // Step 1: Table & Key Schema
    const [tableName, setTableName] = useState('')
    const [pkName, setPkName] = useState('')
    const [pkType, setPkType] = useState<ScalarType>('S')
    const [hasSortKey, setHasSortKey] = useState(false)
    const [skName, setSkName] = useState('')
    const [skType, setSkType] = useState<ScalarType>('S')

    // Step 2: Capacity & Billing
    const [billingMode, setBillingMode] = useState<BillingMode>('PAY_PER_REQUEST')
    const [rcu, setRcu] = useState(5)
    const [wcu, setWcu] = useState(5)

    const resetState = () => {
        setCurrent(0)
        setTableName('')
        setPkName('')
        setPkType('S')
        setHasSortKey(false)
        setSkName('')
        setSkType('S')
        setBillingMode('PAY_PER_REQUEST')
        setRcu(5)
        setWcu(5)
    }

    const validateStep0 = (): boolean => {
        const trimmedTable = tableName.trim()
        if (!trimmedTable) {
            message.error('Please enter a Table Name')
            return false
        }
        const trimmedPk = pkName.trim()
        if (!trimmedPk) {
            message.error('Please enter a Partition Key name')
            return false
        }
        if (hasSortKey) {
            const trimmedSk = skName.trim()
            if (!trimmedSk) {
                message.error('Please enter a Sort Key name or disable Sort Key')
                return false
            }
            if (trimmedSk === trimmedPk) {
                message.error('Sort Key name cannot be identical to Partition Key name')
                return false
            }
        }
        return true
    }

    const handleNext = () => {
        if (current === 0 && !validateStep0()) {
            return
        }
        setCurrent(c => c + 1)
    }

    const handleCreate = async () => {
        if (!validateStep0()) return

        const trimmedTable = tableName.trim()
        const trimmedPk = pkName.trim()
        const trimmedSk = skName.trim()

        const request: CreateTableRequest = {
            tableName: trimmedTable,
            partitionKey: {
                name: trimmedPk,
                attributeType: pkType,
            },
            sortKey: hasSortKey && trimmedSk ? {
                name: trimmedSk,
                attributeType: skType,
            } : undefined,
            billingMode,
            provisionedThroughput: billingMode === 'PROVISIONED' ? {
                readCapacityUnits: rcu,
                writeCapacityUnits: wcu,
            } : undefined,
        }

        setLoading(true)
        try {
            const res = await window.api.tables.create(request)
            if (res && res.success) {
                message.success(`Table "${trimmedTable}" created successfully!`)
                onCreated(trimmedTable)
                resetState()
                onClose()
            } else {
                message.error('Failed to create table')
            }
        } catch (err: any) {
            message.error(typeof err === 'string' ? err : err?.message ?? 'Failed to create table')
        } finally {
            setLoading(false)
        }
    }

    const steps = [
        {
            title: 'Primary Keys',
            icon: <KeyOutlined />,
            content: (
                <Form layout="vertical" requiredMark={false}>
                    <Form.Item
                        label="Table Name"
                        required
                        help="Enter a unique name for your DynamoDB table (e.g. Users, Orders)"
                    >
                        <Input
                            placeholder="e.g. Users"
                            value={tableName}
                            onChange={e => setTableName(e.target.value)}
                            size="large"
                            prefix={<DatabaseOutlined style={{ color: 'var(--color-text-secondary)' }} />}
                        />
                    </Form.Item>

                    <Card size="small" title="Partition Key (Hash Key)" style={{ marginBottom: 16 }}>
                        <Space style={{ width: '100%' }} align="start">
                            <Form.Item
                                label="Attribute Name"
                                required
                                style={{ marginBottom: 0, minWidth: 280 }}
                            >
                                <Input
                                    placeholder="e.g. id or userId"
                                    value={pkName}
                                    onChange={e => setPkName(e.target.value)}
                                />
                            </Form.Item>
                            <Form.Item label="Type" style={{ marginBottom: 0, width: 160 }}>
                                <Select value={pkType} onChange={v => setPkType(v)}>
                                    <Option value="S">String (S)</Option>
                                    <Option value="N">Number (N)</Option>
                                    <Option value="B">Binary (B)</Option>
                                </Select>
                            </Form.Item>
                        </Space>
                    </Card>

                    <Card
                        size="small"
                        title={
                            <Space>
                                <span>Sort Key (Range Key)</span>
                                <Switch
                                    checked={hasSortKey}
                                    onChange={setHasSortKey}
                                />
                            </Space>
                        }
                    >
                        {hasSortKey ? (
                            <Space style={{ width: '100%' }} align="start">
                                <Form.Item
                                    label="Attribute Name"
                                    required
                                    style={{ marginBottom: 0, minWidth: 280 }}
                                >
                                    <Input
                                        placeholder="e.g. createdAt or timestamp"
                                        value={skName}
                                        onChange={e => setSkName(e.target.value)}
                                    />
                                </Form.Item>
                                <Form.Item label="Type" style={{ marginBottom: 0, width: 160 }}>
                                    <Select value={skType} onChange={v => setSkType(v)}>
                                        <Option value="S">String (S)</Option>
                                        <Option value="N">Number (N)</Option>
                                        <Option value="B">Binary (B)</Option>
                                    </Select>
                                </Form.Item>
                            </Space>
                        ) : (
                            <Text type="secondary" style={{ fontSize: 13 }}>
                                Sort key is optional. Enable if your table uses a composite primary key.
                            </Text>
                        )}
                    </Card>
                </Form>
            )
        },
        {
            title: 'Capacity & Summary',
            icon: <ThunderboltOutlined />,
            content: (
                <Form layout="vertical" requiredMark={false}>
                    <Form.Item label="Billing / Capacity Mode">
                        <Select
                            value={billingMode}
                            onChange={v => setBillingMode(v)}
                            size="large"
                        >
                            <Option value="PAY_PER_REQUEST">On-Demand (Pay per request — Recommended)</Option>
                            <Option value="PROVISIONED">Provisioned (Set manual RCU & WCU)</Option>
                        </Select>
                    </Form.Item>

                    {billingMode === 'PROVISIONED' && (
                        <Space size="large" style={{ marginBottom: 16 }}>
                            <Form.Item label="Read Capacity Units (RCU)">
                                <InputNumber min={1} max={40000} value={rcu} onChange={v => setRcu(v ?? 1)} />
                            </Form.Item>
                            <Form.Item label="Write Capacity Units (WCU)">
                                <InputNumber min={1} max={40000} value={wcu} onChange={v => setWcu(v ?? 1)} />
                            </Form.Item>
                        </Space>
                    )}

                    <div style={{
                        background: 'var(--color-surface-2, #1f1f1f)',
                        border: '1px solid var(--color-border, #303030)',
                        borderRadius: 8,
                        padding: 16,
                        marginTop: 12
                    }}>
                        <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
                            Schema Summary
                        </Title>
                        <Space orientation="vertical" orientationMargin="0" style={{ width: '100%', gap: 6 }}>
                            <div><strong>Table:</strong> <code>{tableName.trim() || '—'}</code></div>
                            <div>
                                <strong>Partition Key:</strong>{' '}
                                <code>{pkName.trim() || '—'} ({pkType})</code>
                            </div>
                            {hasSortKey && (
                                <div>
                                    <strong>Sort Key:</strong>{' '}
                                    <code>{skName.trim() || '—'} ({skType})</code>
                                </div>
                            )}
                            <div>
                                <strong>Capacity:</strong>{' '}
                                {billingMode === 'PAY_PER_REQUEST' ? 'On-Demand' : `Provisioned (${rcu} RCU / ${wcu} WCU)`}
                            </div>
                        </Space>
                    </div>
                </Form>
            )
        }
    ]

    return (
        <Modal
            open={open}
            title="Create DynamoDB Table"
            onCancel={() => { onClose(); resetState() }}
            footer={null}
            width={580}
            destroyOnClose
        >
            <Steps
                current={current}
                size="small"
                style={{ marginBottom: 24, marginTop: 12 }}
                items={steps.map(s => ({ title: s.title, icon: s.icon }))}
            />

            <div style={{ minHeight: 340 }}>
                {steps[current].content}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24, borderTop: '1px solid var(--color-border, #303030)', paddingTop: 16 }}>
                {current > 0 && (
                    <Button onClick={() => setCurrent(c => c - 1)}>Back</Button>
                )}
                {current < steps.length - 1 && (
                    <Button type="primary" onClick={handleNext}>
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
