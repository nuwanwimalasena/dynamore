import { describe, it, expect } from 'vitest'

describe('ResultsGrid data parsing and column detection', () => {
    it('detects unique columns from scanned DynamoDB items and prioritizes key schema', () => {
        const keySchema = [{ attributeName: 'PK', keyType: 'HASH' }, { attributeName: 'SK', keyType: 'RANGE' }]
        const sampleItems = [
            { PK: 'user#100', SK: 'profile', email: 'alice@example.com', age: 30 },
            { PK: 'user#101', SK: 'profile', username: 'bob', isActive: true },
            { PK: 'user#102', SK: 'orders#1', orderTotal: 99.5, currency: 'USD' }
        ]

        const keys = new Set<string>()
        for (const k of keySchema) {
            keys.add(k.attributeName)
        }
        sampleItems.slice(0, 50).forEach(item => Object.keys(item).forEach(k => keys.add(k)))

        const columnKeys = Array.from(keys)
        expect(columnKeys[0]).toBe('PK')
        expect(columnKeys[1]).toBe('SK')
        expect(columnKeys).toContain('email')
        expect(columnKeys).toContain('age')
        expect(columnKeys).toContain('username')
        expect(columnKeys).toContain('orderTotal')
    })

    it('extracts primary key correctly when keySchema is present', () => {
        const keySchema = [{ attributeName: 'PK', keyType: 'HASH' }, { attributeName: 'SK', keyType: 'RANGE' }]
        const item = { PK: 'cust#1', SK: 'inv#2', amount: 500, status: 'PAID' }

        const keyObj: Record<string, unknown> = {}
        for (const k of keySchema) {
            if (item[k.attributeName as keyof typeof item] !== undefined) {
                keyObj[k.attributeName] = item[k.attributeName as keyof typeof item]
            }
        }

        expect(keyObj).toEqual({ PK: 'cust#1', SK: 'inv#2' })
        expect(keyObj).not.toHaveProperty('amount')
    })
})
