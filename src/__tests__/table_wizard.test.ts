import { describe, it, expect } from 'vitest'
import type { CreateTableRequest, ScalarType, BillingMode } from '../types/dynamo'

describe('CreateTableWizard validation and transformation logic', () => {
    function validateForm(tableName: string, pkName: string, hasSortKey: boolean, skName: string): { valid: boolean; error?: string } {
        const trimmedTable = tableName.trim()
        if (!trimmedTable) return { valid: false, error: 'Table name is required' }

        const trimmedPk = pkName.trim()
        if (!trimmedPk) return { valid: false, error: 'Partition key is required' }

        if (hasSortKey) {
            const trimmedSk = skName.trim()
            if (!trimmedSk) return { valid: false, error: 'Sort key is required when enabled' }
            if (trimmedSk === trimmedPk) return { valid: false, error: 'Sort key cannot be identical to partition key' }
        }

        return { valid: true }
    }

    function buildCreateTablePayload(
        tableName: string,
        pkName: string,
        pkType: ScalarType,
        hasSortKey: boolean,
        skName: string,
        skType: ScalarType,
        billingMode: BillingMode,
        rcu: number,
        wcu: number
    ): CreateTableRequest {
        return {
            tableName: tableName.trim(),
            partitionKey: {
                name: pkName.trim(),
                attributeType: pkType
            },
            sortKey: hasSortKey && skName.trim() ? {
                name: skName.trim(),
                attributeType: skType
            } : undefined,
            billingMode,
            provisionedThroughput: billingMode === 'PROVISIONED' ? {
                readCapacityUnits: rcu,
                writeCapacityUnits: wcu
            } : undefined
        }
    }

    it('rejects empty or whitespace table names', () => {
        expect(validateForm('', 'id', false, '').valid).toBe(false)
        expect(validateForm('   ', 'id', false, '').valid).toBe(false)
    })

    it('rejects empty partition keys', () => {
        expect(validateForm('Users', '', false, '').valid).toBe(false)
        expect(validateForm('Users', '   ', false, '').valid).toBe(false)
    })

    it('rejects identical partition and sort keys', () => {
        const result = validateForm('Users', 'userId', true, 'userId')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('cannot be identical')
    })

    it('accepts valid composite key table parameters', () => {
        const result = validateForm('Orders', 'orderId', true, 'createdAt')
        expect(result.valid).toBe(true)

        const payload = buildCreateTablePayload(
            'Orders',
            'orderId',
            'S',
            true,
            'createdAt',
            'N',
            'PAY_PER_REQUEST',
            5,
            5
        )

        expect(payload.tableName).toBe('Orders')
        expect(payload.partitionKey).toEqual({ name: 'orderId', attributeType: 'S' })
        expect(payload.sortKey).toEqual({ name: 'createdAt', attributeType: 'N' })
        expect(payload.billingMode).toBe('PAY_PER_REQUEST')
        expect(payload.provisionedThroughput).toBeUndefined()
    })

    it('attaches provisioned throughput only when billing mode is PROVISIONED', () => {
        const payload = buildCreateTablePayload(
            'Logs',
            'logId',
            'S',
            false,
            '',
            'S',
            'PROVISIONED',
            20,
            10
        )

        expect(payload.billingMode).toBe('PROVISIONED')
        expect(payload.provisionedThroughput).toEqual({
            readCapacityUnits: 20,
            writeCapacityUnits: 10
        })
    })
})
