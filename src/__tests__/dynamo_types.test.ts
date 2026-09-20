import { describe, it, expect } from 'vitest'
import type { CreateTableRequest } from '../types/dynamo'

describe('DynamoDB DTOs and Validation', () => {
    it('constructs valid on-demand CreateTableRequest', () => {
        const req: CreateTableRequest = {
            tableName: 'Users',
            partitionKey: {
                name: 'userId',
                attributeType: 'S'
            },
            sortKey: {
                name: 'createdAt',
                attributeType: 'N'
            },
            billingMode: 'PAY_PER_REQUEST'
        }

        expect(req.tableName).toBe('Users')
        expect(req.partitionKey.name).toBe('userId')
        expect(req.partitionKey.attributeType).toBe('S')
        expect(req.sortKey?.name).toBe('createdAt')
        expect(req.sortKey?.attributeType).toBe('N')
        expect(req.billingMode).toBe('PAY_PER_REQUEST')
    })

    it('constructs valid provisioned CreateTableRequest with GSIs', () => {
        const req: CreateTableRequest = {
            tableName: 'Orders',
            partitionKey: {
                name: 'orderId',
                attributeType: 'S'
            },
            billingMode: 'PROVISIONED',
            provisionedThroughput: {
                readCapacityUnits: 10,
                writeCapacityUnits: 5
            },
            globalSecondaryIndexes: [
                {
                    indexName: 'CustomerIndex',
                    partitionKey: {
                        name: 'customerId',
                        attributeType: 'S'
                    },
                    sortKey: {
                        name: 'orderDate',
                        attributeType: 'S'
                    },
                    projectionType: 'ALL'
                }
            ]
        }

        expect(req.billingMode).toBe('PROVISIONED')
        expect(req.provisionedThroughput?.readCapacityUnits).toBe(10)
        expect(req.globalSecondaryIndexes?.length).toBe(1)
        expect(req.globalSecondaryIndexes?.[0].indexName).toBe('CustomerIndex')
    })

    it('extracts primary key attributes correctly based on table schema', () => {
        const tableDetail = {
            tableName: 'Products',
            keySchema: [
                { attributeName: 'category', keyType: 'HASH' },
                { attributeName: 'sku', keyType: 'RANGE' }
            ],
            attributeDefinitions: [
                { attributeName: 'category', attributeType: 'S' },
                { attributeName: 'sku', attributeType: 'S' }
            ],
            globalSecondaryIndexes: [],
            localSecondaryIndexes: []
        }

        const item = {
            category: 'Electronics',
            sku: 'ELEC-1234',
            title: 'Wireless Headphones',
            price: 99.99,
            stock: 45
        }

        const extractedKey: Record<string, unknown> = {}
        for (const k of tableDetail.keySchema) {
            extractedKey[k.attributeName] = item[k.attributeName as keyof typeof item]
        }

        expect(extractedKey).toEqual({
            category: 'Electronics',
            sku: 'ELEC-1234'
        })
        expect(extractedKey).not.toHaveProperty('title')
        expect(extractedKey).not.toHaveProperty('price')
    })
})
