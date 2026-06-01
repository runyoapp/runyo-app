import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Activity, Race, PersonalRecord } from '@/types/activity'
import type { SchemaEntry } from '@/types/auth'
import { createSchema, getMySchemas, activateSchema } from '@/services/schemas'

const SCHEMA_ID_KEY = 'runyo_schema_id'

export type TabName = 'today' | 'week' | 'plan' | 'calendar'

type DataStore = {
  activities: Activity[]
  races: Race[]
  prs: PersonalRecord[]

  // Active backend schema
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
  clearAll: () => Promise<void>
  hydrateSchema: () => Promise<void>
  // Backend schema actions
  loadMySchemas: () => Promise<void>
  activateSchemaById: (id: string, name: string) => Promise<void>
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
  // BUG9: bij uitloggen alle schema-/activiteit-state wissen,
  // anders blijft een schema zichtbaar na logout.
  clearAll: async () => {
    set({
      activities: [], races: [], prs: [],
      schemaId: null, schemaName: null,
    })
    await AsyncStorage.multiRemove([SCHEMA_ID_KEY, 'runyo_schema_name'])
  },
  hydrateSchema: async () => {
    const storedSchemaId   = await AsyncStorage.getItem(SCHEMA_ID_KEY)
    const storedSchemaName = await AsyncStorage.getItem('runyo_schema_name')
    if (storedSchemaId) set({ schemaId: storedSchemaId, schemaName: storedSchemaName ?? null })
  },

  loadMySchemas: async () => {
    const list = await getMySchemas()
    const active = list.find(s => s.isActive) ?? list[0] ?? null
    if (active) {
      set({ schemaId: active.id, schemaName: active.name })
      await AsyncStorage.setItem(SCHEMA_ID_KEY, active.id)
      await AsyncStorage.setItem('runyo_schema_name', active.name)
    } else {
      set({ schemaId: null, schemaName: null })
      await AsyncStorage.removeItem(SCHEMA_ID_KEY)
      await AsyncStorage.removeItem('runyo_schema_name')
    }
  },
  activateSchemaById: async (id, name) => {
    await activateSchema(id)
    set({ schemaId: id, schemaName: name })
    await AsyncStorage.setItem(SCHEMA_ID_KEY, id)
    await AsyncStorage.setItem('runyo_schema_name', name)
  },
  activateImport: async (schemaId, schemaName) => {
    set({ schemaId, schemaName })
    await AsyncStorage.setItem(SCHEMA_ID_KEY, schemaId)
    await AsyncStorage.setItem('runyo_schema_name', schemaName ?? '')
  },

  setTab: (currentTab) => set({ currentTab }),
  setWeekOffset: (weekOffset) => set({ weekOffset }),
  setDayOffset: (dayOffset) => set({ dayOffset }),
  setCalDate: (calYear, calMonth) => set({ calYear, calMonth }),
  setPlanWeekOffset: (planWeekOffset) => set({ planWeekOffset }),
  setSelectedFase: (selectedFase) => set({ selectedFase }),
}))
