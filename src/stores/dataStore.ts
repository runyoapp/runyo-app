import { create } from 'zustand'
import type { Activity, Race, PersonalRecord } from '@/types/activity'
import type { SchemaEntry } from '@/types/auth'

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
  setSchema: (sheetId: string, tabName: string, fileName: string, tabId: number) => void
  clearSchema: () => void
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
  setSchema: (sheetId, tabName, sheetFileName, sheetTabId) =>
    set({ sheetId, tabName, sheetFileName, sheetTabId }),
  clearSchema: () =>
    set({ sheetId: null, tabName: 'Schema', sheetFileName: null, sheetTabId: null }),

  setTab: (currentTab) => set({ currentTab }),
  setWeekOffset: (weekOffset) => set({ weekOffset }),
  setDayOffset: (dayOffset) => set({ dayOffset }),
  setCalDate: (calYear, calMonth) => set({ calYear, calMonth }),
  setPlanWeekOffset: (planWeekOffset) => set({ planWeekOffset }),
  setSelectedFase: (selectedFase) => set({ selectedFase }),
}))
