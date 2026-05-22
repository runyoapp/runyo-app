import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Activity, Race, PersonalRecord } from '@/types/activity'
import type { SchemaEntry } from '@/types/auth'
import { createSchema, getMySchemas } from '@/services/schemas'

const SCHEMA_KEY = 'runyo_schema'
const SCHEMA_ID_KEY = 'runyo_schema_id'

export type TabName = 'today' | 'week' | 'plan' | 'calendar'

type DataStore = {
  activities: Activity[]
  races: Race[]
  prs: PersonalRecord[]

  // Active schema
  sheetId: string | null
  tabName: string
  sheetFileName: string | null
  sheetTabId: number | null

  // Backend schema id (1.2d tracer — independent from sheetId until 1.2e/2.1 unifies the flow)
  schemaId: string | null
  schemaName: string | null

  // Navigation state
  currentTab: TabName
  weekOffset: number
  dayOffset: number
  calYear: number
  calMonth: number
  planWeekOffset: number
  selectedFase: string | null

  // Actions
  setActivities: (activities: Activity[]) => void
  upsertActivity: (activity: Activity) => void
  removeActivity: (id: string) => void
  setRaces: (races: Race[]) => void
  upsertRace: (race: Race) => void
  removeRace: (id: string) => void
  setPrs: (prs: PersonalRecord[]) => void
  setSchema: (sheetId: string, tabName: string, fileName: string, tabId: number) => Promise<void>
  clearSchema: () => Promise<void>
  hydrateSchema: () => Promise<void>
  // Backend schema actions (1.2d tracer)
  loadMySchemas: () => Promise<void>
  createNewSchema: () => Promise<void>
  activateImport: (schemaId: string, schemaName: string) => Promise<void>
  setTab: (tab: TabName) => void
  setWeekOffset: (offset: number) => void
  setDayOffset: (offset: number) => void
  setCalDate: (year: number, month: number) => void
  setPlanWeekOffset: (offset: number) => void
  setSelectedFase: (fase: string | null) => void
}

export const useDataStore = create<DataStore>((set) => ({
  activities: [],
  races: [],
  prs: [],

  sheetId: null,
  tabName: 'Schema',
  sheetFileName: null,
  sheetTabId: null,

  schemaId: null,
  schemaName: null,

  currentTab: 'today',
  weekOffset: 0,
  dayOffset: 0,
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  planWeekOffset: 0,
  selectedFase: null,

  setActivities: (activities) => set({ activities }),
  upsertActivity: (activity) =>
    set((s) => ({
      activities: s.activities.some(a => a.id === activity.id)
        ? s.activities.map(a => a.id === activity.id ? activity : a)
        : [...s.activities, activity],
    })),
  removeActivity: (id) =>
    set((s) => ({ activities: s.activities.filter(a => a.id !== id) })),

  setRaces: (races) => set({ races }),
  upsertRace: (race) =>
    set((s) => ({
      races: s.races.some(r => r.id === race.id)
        ? s.races.map(r => r.id === race.id ? race : r)
        : [...s.races, race],
    })),
  removeRace: (id) =>
    set((s) => ({ races: s.races.filter(r => r.id !== id) })),

  setPrs: (prs) => set({ prs }),
  setSchema: async (sheetId, tabName, sheetFileName, sheetTabId) => {
    set({ sheetId, tabName, sheetFileName, sheetTabId })
    await AsyncStorage.setItem(SCHEMA_KEY, JSON.stringify({ sheetId, tabName, sheetFileName, sheetTabId }))
  },
  clearSchema: async () => {
    set({ sheetId: null, tabName: 'Schema', sheetFileName: null, sheetTabId: null, activities: [] })
    await AsyncStorage.removeItem(SCHEMA_KEY)
  },
  hydrateSchema: async () => {
    const raw = await AsyncStorage.getItem(SCHEMA_KEY)
    const storedSchemaId   = await AsyncStorage.getItem(SCHEMA_ID_KEY)
    const storedSchemaName = await AsyncStorage.getItem('runyo_schema_name')
    if (storedSchemaId) set({ schemaId: storedSchemaId, schemaName: storedSchemaName ?? null })
    if (!raw) return
    const parsed = JSON.parse(raw)
    set({ sheetId: parsed.sheetId, tabName: parsed.tabName, sheetFileName: parsed.sheetFileName, sheetTabId: parsed.sheetTabId })
  },

  // TODO(1.2e/2.1): tracer actions — fold into a real schema-aware flow.
  loadMySchemas: async () => {
    const list = await getMySchemas()
    const id = list[0]?.id ?? null
    set({ schemaId: id })
    if (id) {
      await AsyncStorage.setItem(SCHEMA_ID_KEY, id)
    } else {
      await AsyncStorage.removeItem(SCHEMA_ID_KEY)
    }
  },
  createNewSchema: async () => {
    const result = await createSchema()
    set({ schemaId: result.id })
    await AsyncStorage.setItem(SCHEMA_ID_KEY, result.id)
  },
  activateImport: async (schemaId, schemaName) => {
    set({ schemaId, schemaName, sheetId: null, tabName: 'Schema', sheetFileName: null, sheetTabId: null })
    await AsyncStorage.setItem(SCHEMA_ID_KEY, schemaId)
    await AsyncStorage.setItem('runyo_schema_name', schemaName ?? '')
    await AsyncStorage.removeItem(SCHEMA_KEY)
  },

  setTab: (currentTab) => set({ currentTab }),
  setWeekOffset: (weekOffset) => set({ weekOffset }),
  setDayOffset: (dayOffset) => set({ dayOffset }),
  setCalDate: (calYear, calMonth) => set({ calYear, calMonth }),
  setPlanWeekOffset: (planWeekOffset) => set({ planWeekOffset }),
  setSelectedFase: (selectedFase) => set({ selectedFase }),
}))
