import { describe, it, expect } from 'vitest'

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

describe('DynamoDB Expression Builder', () => {
    it('returns empty string for empty filter array', () => {
        const attrNames: Record<string, string> = {}
        const attrValues: Record<string, unknown> = {}
        const expr = buildExpression([], attrNames, attrValues, 'f')
        expect(expr).toBe('')
        expect(attrNames).toEqual({})
        expect(attrValues).toEqual({})
    })

    it('builds equality filter expression', () => {
        const attrNames: Record<string, string> = {}
        const attrValues: Record<string, unknown> = {}
        const filters: FilterRow[] = [{ attr: 'status', op: '=', val: 'ACTIVE' }]

        const expr = buildExpression(filters, attrNames, attrValues, 'f')
        expect(expr).toBe('#fattr0 = :fval0')
        expect(attrNames['#fattr0']).toBe('status')
        expect(attrValues[':fval0']).toBe('ACTIVE')
    })

    it('builds begins_with and contains functional expressions', () => {
        const attrNames: Record<string, string> = {}
        const attrValues: Record<string, unknown> = {}
        const filters: FilterRow[] = [
            { attr: 'email', op: 'begins_with', val: 'admin@' },
            { attr: 'description', op: 'contains', val: 'urgent' }
        ]

        const expr = buildExpression(filters, attrNames, attrValues, 'f')
        expect(expr).toBe('begins_with(#fattr0, :fval0) AND contains(#fattr1, :fval1)')
        expect(attrNames['#fattr0']).toBe('email')
        expect(attrNames['#fattr1']).toBe('description')
        expect(attrValues[':fval0']).toBe('admin@')
        expect(attrValues[':fval1']).toBe('urgent')
    })

    it('builds attribute_exists without generating unnecessary value tokens', () => {
        const attrNames: Record<string, string> = {}
        const attrValues: Record<string, unknown> = {}
        const filters: FilterRow[] = [
            { attr: 'deletedAt', op: 'attribute_not_exists', val: '' }
        ]

        const expr = buildExpression(filters, attrNames, attrValues, 'f')
        expect(expr).toBe('attribute_not_exists(#fattr0)')
        expect(attrNames['#fattr0']).toBe('deletedAt')
        expect(Object.keys(attrValues).length).toBe(0)
    })
})
