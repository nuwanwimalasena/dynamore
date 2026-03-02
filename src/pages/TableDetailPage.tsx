import { useState } from 'react'
import { Tabs, Typography, Descriptions, Tag, Space, Empty, Spin, Button } from 'antd'
import {
    ThunderboltOutlined, ScanOutlined, UnorderedListOutlined,
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

    const keySchema = table.KeySchema ?? []
    const gsiList = (table.GlobalSecondaryIndexes ?? []) as Array<{ IndexName?: string; KeySchema?: unknown[]; ItemCount?: number }>
    const lsiList = (table.LocalSecondaryIndexes ?? []) as Array<{ IndexName?: string }>

    const infoContent = (
        <div style={{ padding: '16px 20px', overflow: 'auto', flex: 1 }}>
            <Descriptions
                size="small"
                bordered
                column={2}
                labelStyle={{ color: 'var(--color-text-secondary)', fontSize: 12 }}
                contentStyle={{ color: 'var(--color-text-primary)', fontSize: 13 }}
            >
                <Descriptions.Item label="Table Name" span={2}>{table.TableName}</Descriptions.Item>
                <Descriptions.Item label="Status">
                    <Tag color={table.TableStatus === 'ACTIVE' ? 'green' : 'orange'}>{table.TableStatus}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Item Count">
                    {table.ItemCount?.toLocaleString() ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Size">
                    {table.TableSizeBytes !== undefined
                        ? `${(table.TableSizeBytes / 1024).toFixed(1)} KB`
                        : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Billing">
                    {table.BillingModeSummary?.BillingMode ?? 'PROVISIONED'}
                </Descriptions.Item>
                {table.ProvisionedThroughput && (
                    <>
                        <Descriptions.Item label="Read Capacity">
                            {table.ProvisionedThroughput.ReadCapacityUnits}
                        </Descriptions.Item>
                        <Descriptions.Item label="Write Capacity">
                            {table.ProvisionedThroughput.WriteCapacityUnits}
                        </Descriptions.Item>
                    </>
                )}
                <Descriptions.Item label="Created" span={2}>
                    {table.CreationDateTime
                        ? new Date(table.CreationDateTime).toLocaleString()
                        : '—'}
                </Descriptions.Item>
            </Descriptions>

            {/* Keys */}
            <Title level={5} style={{ margin: '20px 0 8px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                Key Schema
            </Title>
            <Space wrap>
                {keySchema.map(k => (
                    <Tag key={k.AttributeName} color={k.KeyType === 'HASH' ? 'blue' : 'cyan'}>
                        {k.AttributeName} ({k.KeyType})
                    </Tag>
                ))}
            </Space>

            {/* Attributes */}
            <Title level={5} style={{ margin: '20px 0 8px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                Attribute Definitions
            </Title>
            <Space wrap>
                {(table.AttributeDefinitions ?? []).map((a: { AttributeName: string; AttributeType: string }) => (
                    <Tag key={a.AttributeName}>{a.AttributeName} ({a.AttributeType})</Tag>
                ))}
            </Space>

            {/* GSIs */}
            {gsiList.length > 0 && (
                <>
                    <Title level={5} style={{ margin: '20px 0 8px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                        Global Secondary Indexes ({gsiList.length})
                    </Title>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        {gsiList.map(gsi => (
                            <div key={gsi.IndexName} style={{
                                padding: '8px 12px',
                                background: 'var(--color-surface-2)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 12
                            }}>
                                <Text style={{ color: 'var(--color-accent-blue)', fontWeight: 600 }}>{gsi.IndexName}</Text>
                                <br />
                                <Space wrap style={{ marginTop: 4 }}>
                                    {((gsi.KeySchema ?? []) as Array<{ AttributeName: string; KeyType: string }>).map(k => (
                                        <Tag key={k.AttributeName} color={k.KeyType === 'HASH' ? 'blue' : 'cyan'} style={{ fontSize: 11 }}>
                                            {k.AttributeName} ({k.KeyType})
                                        </Tag>
                                    ))}
                                </Space>
                            </div>
                        ))}
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
                        {lsiList.map(lsi => (
                            <Tag key={lsi.IndexName} color="purple">{lsi.IndexName}</Tag>
                        ))}
                    </Space>
                </>
            )}
        </div>
    )

    const resultItems = activeTab === 'query' ? queryResults : scanResults

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
                    style={{ flex: 'none' }}
                    tabBarStyle={{
                        margin: 0,
                        paddingLeft: 16,
                        paddingRight: 16,
                        borderBottom: '1px solid var(--color-border)'
                    }}
                    renderTabBar={(props, DefaultTabBar) => <DefaultTabBar {...props} style={{ marginBottom: 0 }} />}
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
                            key: 'items',
                            label: <Space size={6}><UnorderedListOutlined />Items</Space>,
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

                    {activeTab === 'items' && (
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <ResultsGrid
                                items={resultItems}
                                mode={activeTab === 'items' ? 'scan' : activeTab}
                                onEdit={item => setEditItem(item)}
                            />
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
