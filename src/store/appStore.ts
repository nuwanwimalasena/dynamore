import { create } from 'zustand'
import type { Session, TableDescription } from '../types/global'

interface AppStore {
    // Auth
    session: Session | null
    setSession: (session: Session | null) => void

    // Tables
    tableNames: string[]
    selectedTable: string | null
    tableDetails: Record<string, TableDescription>
    setTableNames: (names: string[]) => void
    setSelectedTable: (name: string | null) => void
    setTableDetail: (name: string, detail: TableDescription) => void

    // Results
    queryResults: Record<string, unknown>[]
    scanResults: Record<string, unknown>[]
    lastEvaluatedKey: Record<string, unknown> | undefined
    setQueryResults: (items: Record<string, unknown>[], key?: Record<string, unknown>) => void
    appendQueryResults: (items: Record<string, unknown>[], key?: Record<string, unknown>) => void
    setScanResults: (items: Record<string, unknown>[], key?: Record<string, unknown>) => void
    appendScanResults: (items: Record<string, unknown>[], key?: Record<string, unknown>) => void

    // UI
    activeTab: 'query' | 'scan' | 'items' | 'info'
    setActiveTab: (tab: 'query' | 'scan' | 'items' | 'info') => void
    selectedItem: Record<string, unknown> | null
    setSelectedItem: (item: Record<string, unknown> | null) => void
}

export const useAppStore = create<AppStore>((set) => ({
    session: null,
    setSession: (session) => set({ session }),

    tableNames: [],
    selectedTable: null,
    tableDetails: {},
    setTableNames: (tableNames) => set({ tableNames }),
    setSelectedTable: (selectedTable) => set({ selectedTable, queryResults: [], scanResults: [], lastEvaluatedKey: undefined }),
    setTableDetail: (name, detail) => set((s) => ({ tableDetails: { ...s.tableDetails, [name]: detail } })),

    queryResults: [],
    scanResults: [],
    lastEvaluatedKey: undefined,
    setQueryResults: (items, key) => set({ queryResults: items, lastEvaluatedKey: key }),
    appendQueryResults: (items, key) => set((s) => ({ queryResults: [...s.queryResults, ...items], lastEvaluatedKey: key })),
    setScanResults: (items, key) => set({ scanResults: items, lastEvaluatedKey: key }),
    appendScanResults: (items, key) => set((s) => ({ scanResults: [...s.scanResults, ...items], lastEvaluatedKey: key })),

    activeTab: 'query',
    setActiveTab: (activeTab) => set({ activeTab }),
    selectedItem: null,
    setSelectedItem: (selectedItem) => set({ selectedItem })
}))
