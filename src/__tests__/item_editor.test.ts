import { describe, it, expect } from 'vitest'

interface KeyValueRow {
    key: string
    type: 'string' | 'number' | 'boolean' | 'null' | 'list' | 'map'
    value: any
}

function objectToRows(obj: Record<string, unknown>): KeyValueRow[] {
    return Object.entries(obj).map(([key, val]) => {
        let type: KeyValueRow['type'] = 'string'
        let value: any = val
        if (val === null) {
            type = 'null'
            value = null
        } else if (typeof val === 'boolean') {
            type = 'boolean'
            value = val
        } else if (typeof val === 'number') {
            type = 'number'
            value = String(val)
        } else if (Array.isArray(val)) {
            type = 'list'
            value = JSON.stringify(val)
        } else if (typeof val === 'object') {
            type = 'map'
            value = JSON.stringify(val)
        } else {
            type = 'string'
            value = String(val)
        }
        return { key, type, value }
    })
}

function rowsToObject(rows: KeyValueRow[]): Record<string, unknown> {
    const obj: Record<string, unknown> = {}
    rows.forEach(row => {
        if (!row.key) return
        let parsedVal: any = row.value
        if (row.type === 'number') {
            const num = Number(row.value)
            parsedVal = isNaN(num) ? row.value : num
        } else if (row.type === 'boolean') {
            parsedVal = row.value === true || row.value === 'true'
        } else if (row.type === 'null') {
            parsedVal = null
        } else if (row.type === 'list' || row.type === 'map') {
            try {
                parsedVal = JSON.parse(row.value)
            } catch {
                parsedVal = row.value
            }
        }
        obj[row.key] = parsedVal
    })
    return obj
}

describe('ItemEditor Bidirectional Transformations', () => {
    it('converts object with multiple types to form rows correctly', () => {
        const item = {
            id: 'user_123',
            age: 29,
            active: true,
            notes: null,
            tags: ['dynamo', 'aws'],
            metadata: { env: 'prod' }
        }

        const rows = objectToRows(item)
        expect(rows).toHaveLength(6)

        const idRow = rows.find(r => r.key === 'id')
        expect(idRow).toEqual({ key: 'id', type: 'string', value: 'user_123' })

        const ageRow = rows.find(r => r.key === 'age')
        expect(ageRow).toEqual({ key: 'age', type: 'number', value: '29' })

        const activeRow = rows.find(r => r.key === 'active')
        expect(activeRow).toEqual({ key: 'active', type: 'boolean', value: true })

        const notesRow = rows.find(r => r.key === 'notes')
        expect(notesRow).toEqual({ key: 'notes', type: 'null', value: null })

        const tagsRow = rows.find(r => r.key === 'tags')
        expect(tagsRow).toEqual({ key: 'tags', type: 'list', value: '["dynamo","aws"]' })

        const metaRow = rows.find(r => r.key === 'metadata')
        expect(metaRow).toEqual({ key: 'metadata', type: 'map', value: '{"env":"prod"}' })
    })

    it('converts form rows back to typed JSON object', () => {
        const rows: KeyValueRow[] = [
            { key: 'id', type: 'string', value: 'user_123' },
            { key: 'score', type: 'number', value: '98.5' },
            { key: 'verified', type: 'boolean', value: 'true' },
            { key: 'deletedAt', type: 'null', value: null },
            { key: 'roles', type: 'list', value: '["admin", "dev"]' },
            { key: 'config', type: 'map', value: '{"theme":"dark"}' }
        ]

        const obj = rowsToObject(rows)
        expect(obj).toEqual({
            id: 'user_123',
            score: 98.5,
            verified: true,
            deletedAt: null,
            roles: ['admin', 'dev'],
            config: { theme: 'dark' }
        })
    })

    it('gracefully handles invalid JSON in list and map rows', () => {
        const rows: KeyValueRow[] = [
            { key: 'brokenList', type: 'list', value: 'invalid json[' },
            { key: 'brokenMap', type: 'map', value: '{unquoted: test' }
        ]

        const obj = rowsToObject(rows)
        expect(obj.brokenList).toBe('invalid json[')
        expect(obj.brokenMap).toBe('{unquoted: test')
    })
})
