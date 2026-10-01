import { useState } from 'react'
import { Tabs, Typography, Descriptions, Tag, Space, Empty, Spin, Button } from 'antd'
import {
    ThunderboltOutlined, ScanOutlined,
    InfoCircleOutlined, PlusOutlined
} from '@ant-design/icons'
import { useAppStore } from '../store/appStore'
import QueryBuilder from '../components/QueryBuilder'
import ScanBuilder from '../components/ScanBuilder'
import ResultsGrid from '../components/ResultsGrid'
import ItemEditor from '../components/ItemEditor'

const { Text, Title } = Typography

export default function TableDetailPage() {
    const {
        selectedTable, tableDetails, queryResults, scanResults, activeTab, setActiveTab
    } = useAppStore()

    const [editItem, setEditItem] = useState<Record<string, unknown> | null | undefined>(undefined)
    // undefined = closed, null = new item, object = edit existing

    const table = selectedTable ? tableDetails[selectedTable] : undefined

    if (!selectedTable) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Empty
                    description={<Text style={{ color: 'var(--color-text-muted)' }}>Select a table from the sidebar</Text>}
                />
            </div>
        )
    }

    if (!table) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Spin size="large" />
            </div>
        )
    }

    const tableName = (table as any).tableName ?? (table as any).TableName ?? ''
    const tableStatus = (table as any).tableStatus ?? (table as any).TableStatus ?? ''
    const itemCount = (table as any).itemCount ?? (table as any).ItemCount
    const tableSizeBytes = (table as any).tableSizeBytes ?? (table as any).TableSizeBytes
    const billingMode = (table as any).billingModeSummary?.billingMode ?? (table as any).BillingModeSummary?.BillingMode ?? 'PROVISIONED'
    const throughput = (table as any).provisionedThroughput ?? (table as any).ProvisionedThroughput
    const creationDate = (table as any).creationDateTime ?? (table as any).CreationDateTime

    const keySchema = ((table as any).keySchema ?? (table as any).KeySchema ?? []) as Array<{ attributeName?: string; AttributeName?: string; keyType?: string; KeyType?: string }>
    const attributeDefs = ((table as any).attributeDefinitions ?? (table as any).AttributeDefinitions ?? []) as Array<{ attributeName?: string; AttributeName?: string; attributeType?: string; AttributeType?: string }>
    const gsiList = (((table as any).globalSecondaryIndexes ?? (table as any).GlobalSecondaryIndexes ?? [])) as Array<{ indexName?: string; IndexName?: string; keySchema?: any[]; KeySchema?: any[] }>
    const lsiList = (((table as any).localSecondaryIndexes ?? (table as any).LocalSecondaryIndexes ?? [])) as Array<{ indexName?: string; IndexName?: string }>

    const infoContent = (
        <div style={{ padding: '16px 20px', overflow: 'auto', flex: 1 }}>
            <Descriptions
                size="small"
                bordered
                column={2}
                labelStyle={{ color: 'var(--color-text-secondary)', fontSize: 12 }}
                contentStyle={{ color: 'var(--color-text-primary)', fontSize: 13 }}
            >
                <Descriptions.Item label="Table Name" span={2}>{tableName}</Descriptions.Item>
                <Descriptions.Item label="Status">
                    <Tag color={tableStatus === 'ACTIVE' ? 'green' : 'orange'}>{tableStatus || '—'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Item Count">
                    {itemCount !== undefined ? Number(itemCount).toLocaleString() : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Size">
                    {tableSizeBytes !== undefined
                        ? `${(Number(tableSizeBytes) / 1024).toFixed(1)} KB`
                        : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Billing">
                    {billingMode}
                </Descriptions.Item>
                {throughput && (
                    <>
                        <Descriptions.Item label="Read Capacity">
                            {throughput.readCapacityUnits ?? throughput.ReadCapacityUnits ?? 0}
                        </Descriptions.Item>
                        <Descriptions.Item label="Write Capacity">
                            {throughput.writeCapacityUnits ?? throughput.WriteCapacityUnits ?? 0}
                        </Descriptions.Item>
                    </>
                )}
                <Descriptions.Item label="Created" span={2}>
                    {creationDate
                        ? new Date(creationDate).toLocaleString()
                        : '—'}
                </Descriptions.Item>
            </Descriptions>

            {/* Keys */}
            <Title level={5} style={{ margin: '20px 0 8px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                Key Schema
            </Title>
            <Space wrap>
                {keySchema.map(k => {
                    const name = k.attributeName ?? k.AttributeName ?? ''
                    const type = k.keyType ?? k.KeyType ?? ''
                    return (
                        <Tag key={name} color={type === 'HASH' ? 'blue' : 'cyan'}>
                            {name} ({type})
                        </Tag>
                    )
                })}
            </Space>

            {/* Attributes */}
            <Title level={5} style={{ margin: '20px 0 8px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                Attribute Definitions
            </Title>
            <Space wrap>
                {attributeDefs.map(a => {
                    const name = a.attributeName ?? a.AttributeName ?? ''
                    const type = a.attributeType ?? a.AttributeType ?? ''
                    return (
                        <Tag key={name}>{name} ({type})</Tag>
                    )
                })}
            </Space>

            {/* GSIs */}
            {gsiList.length > 0 && (
                <>
                    <Title level={5} style={{ margin: '20px 0 8px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                        Global Secondary Indexes ({gsiList.length})
                    </Title>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        {gsiList.map((gsi: any, idx: number) => {
                            const name = gsi.indexName ?? gsi.IndexName ?? (`GSI #${idx + 1}`)
                            const status = gsi.indexStatus ?? gsi.IndexStatus
                            const schema = ((gsi.keySchema ?? gsi.KeySchema ?? []) as any[]).map(k => ({
                                attributeName: k.attributeName ?? k.AttributeName ?? k.attribute_name ?? '',
                                keyType: (k.keyType ?? k.KeyType ?? k.key_type ?? '').toUpperCase()
                            }))
                            const proj = gsi.projection ?? gsi.Projection
                            const projType = proj?.projectionType ?? proj?.ProjectionType

                            return (
                                <div key={name || idx} style={{
                                    padding: '10px 14px',
                                    background: 'var(--color-surface-2)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: 12
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <Space size={8}>
                                            <Text style={{ color: 'var(--color-accent-blue)', fontWeight: 600, fontSize: 13 }}>
                                                {name}
                                            </Text>
                                            {status && (
                                                <Tag color={status === 'ACTIVE' ? 'green' : 'orange'} style={{ fontSize: 11, margin: 0 }}>
                                                    {status}
                                                </Tag>
                                            )}
                                        </Space>
                                        {projType && (
                                            <Tag style={{ fontSize: 11, margin: 0 }}>
                                                Projection: {projType}
                                            </Tag>
                                        )}
                                    </div>
                                    <Space wrap size={6}>
                                        {schema.map(k => (
                                            <Tag key={k.attributeName} color={k.keyType === 'HASH' ? 'blue' : 'cyan'} style={{ fontSize: 11 }}>
                                                {k.attributeName} ({k.keyType})
                                            </Tag>
                                        ))}
                                    </Space>
                                </div>
                            )
                        })}
                    </Space>
                </>
            )}

            {/* LSIs */}
            {lsiList.length > 0 && (
                <>
                    <Title level={5} style={{ margin: '20px 0 8px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                        Local Secondary Indexes ({lsiList.length})
                    </Title>
                    <Space wrap>
                        {lsiList.map((lsi: any, idx: number) => {
                            const name = lsi.indexName ?? lsi.IndexName ?? (`LSI #${idx + 1}`)
                            return (
                                <Tag key={name || idx} color="purple">{name}</Tag>
                            )
                        })}
                    </Space>
                </>
            )}
        </div>
    )

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* Page header */}
                <div style={{
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0
                }}>
                    <Space>
                        <Text style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text-primary)' }}>
                            {selectedTable}
                        </Text>
                        {table.TableStatus && (
                            <Tag color={table.TableStatus === 'ACTIVE' ? 'green' : 'orange'} style={{ fontSize: 11 }}>
                                {table.TableStatus}
                            </Tag>
                        )}
                        {table.ItemCount !== undefined && (
                            <Text style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                                ~{table.ItemCount.toLocaleString()} items
                            </Text>
                        )}
                    </Space>
                    <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => setEditItem(null)}
                    >
                        New Item
                    </Button>
                </div>

                {/* Tabs */}
                <Tabs
                    activeKey={activeTab}
                    onChange={v => setActiveTab(v as typeof activeTab)}
                    size="small"
                    tabBarGutter={16}
                    style={{ flex: 'none' }}
                    renderTabBar={(props, DefaultTabBar) => (
                        <DefaultTabBar
                            {...props}
                            style={{
                                marginBottom: 0,
                                paddingLeft: 20,
                                paddingRight: 20,
                                borderBottom: '1px solid var(--color-border)'
                            }}
                        />
                    )}
                    items={[
                        {
                            key: 'query',
                            label: <Space size={6}><ThunderboltOutlined />Query</Space>,
                            children: null
                        },
                        {
                            key: 'scan',
                            label: <Space size={6}><ScanOutlined />Scan</Space>,
                            children: null
                        },
                        {
                            key: 'info',
                            label: <Space size={6}><InfoCircleOutlined />Info</Space>,
                            children: null
                        }
                    ]}
                />

                {/* Tab content */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {activeTab === 'query' && (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <QueryBuilder table={table} />
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <ResultsGrid
                                    items={queryResults}
                                    mode="query"
                                    onEdit={item => setEditItem(item)}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'scan' && (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <ScanBuilder table={table} />
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <ResultsGrid
                                    items={scanResults}
                                    mode="scan"
                                    onEdit={item => setEditItem(item)}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'info' && infoContent}
                </div>
            </div>

            {/* Item editor drawer */}
            <ItemEditor
                open={editItem !== undefined}
                item={editItem ?? null}
                onClose={() => setEditItem(undefined)}
                onSaved={() => setEditItem(undefined)}
            />
        </>
    )
}
