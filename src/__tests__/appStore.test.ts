import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../store/appStore'

describe('AppStore state management', () => {
    beforeEach(() => {
        useAppStore.setState({
            tableNames: [],
            selectedTable: null,
            tableDetails: {},
            queryResults: [],
            scanResults: [],
            lastEvaluatedKey: undefined,
            activeTab: 'query'
        })
    })

    it('manages table names and selected table properly', () => {
        const store = useAppStore.getState()
        store.setTableNames(['Users', 'Orders'])
        expect(useAppStore.getState().tableNames).toEqual(['Users', 'Orders'])

        store.setSelectedTable('Users')
        expect(useAppStore.getState().selectedTable).toBe('Users')
    })

    it('clears query/scan results when selecting a different table', () => {
        const store = useAppStore.getState()
        store.setQueryResults([{ id: '1' }])
        expect(useAppStore.getState().queryResults.length).toBe(1)

        store.setSelectedTable('NewTable')
        expect(useAppStore.getState().queryResults).toEqual([])
        expect(useAppStore.getState().lastEvaluatedKey).toBeUndefined()
    })

    it('caches and retrieves tableDetails', () => {
        const store = useAppStore.getState()
        const detail: any = {
            tableName: 'Users',
            tableStatus: 'ACTIVE',
            keySchema: [{ attributeName: 'id', keyType: 'HASH' }]
        }
        store.setTableDetail('Users', detail)

        expect(useAppStore.getState().tableDetails['Users']).toEqual(detail)
    })
})
