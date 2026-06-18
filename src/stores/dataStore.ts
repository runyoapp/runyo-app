import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Activity, Race, PersonalRecord } from '@/types/activity'
import { getMySchemas, setSchemaVisibility, archiveSchema, setSchemaSpan, setSchemaColor, type SchemaSpan } from '@/services/schemas'
import { effectiveSpan } from '@/utils/schemaRouting'

// Multi-schema: meerdere schema's kunnen tegelijk zichtbaar zijn. De backend
// (is_visible) is de bron van waarheid; deze key is alleen een optimistische
// cache zodat de app bij opstarten al weet welke schema's zichtbaar waren.
const VISIBLE_IDS_KEY = 'runyo_visible_schema_ids'
// Legacy keys (single-schema) — bij opstarten/uitloggen opruimen.
const LEGACY_KEYS = ['runyo_schema_id', 'runyo_schema_name']

// Schema-ids waarvoor een span-backfill loopt of klaar is — voorkomt dubbele PATCH
// bij herhaalde activiteit-updates binnen dezelfde sessie.
const backfillInFlight = new Set<string>()

export type TabName = 'today' | 'week' | 'plan' | 'calendar'

export type SchemaMeta = {
  id: string
  name: string
  isVisible: boolean
  isArchived: boolean
  // Vaste plan-span (maandag-start + aantal weken). null = legacy → afgeleid.
  startDate: string | null
  weekCount: number | null
  // Schema-kleur (hex). null → paletkleur op volgorde (zie schemaColor()).
  color: string | null
  createdAt: string
}

// Meest recente zichtbare (niet-gearchiveerde) schema's eerst.
function byCreatedAtDesc(a: SchemaMeta, b: SchemaMeta): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

// Leidt de zichtbare set + de "primaire" (= meest recente zichtbare) af uit de
// volledige schemalijst. De primaire dient als fallback-routing en als gate
// ("heb ik een schema?") voor bestaande schermen.
function derive(schemaList: SchemaMeta[]): {
  visibleSchemaIds: string[]
  schemaId: string | null
  schemaName: string | null
} {
  const visible = schemaList.filter(s => s.isVisible && !s.isArchived).sort(byCreatedAtDesc)
  const primary = visible[0] ?? null
  return {
    visibleSchemaIds: visible.map(s => s.id),
    schemaId: primary?.id ?? null,
    schemaName: primary?.name ?? null,
  }
}

async function persistVisible(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(VISIBLE_IDS_KEY, JSON.stringify(ids))
}

type DataStore = {
  activities: Activity[]
  races: Race[]
  prs: PersonalRecord[]

  // Multi-schema state
  schemaList: SchemaMeta[]
  visibleSchemaIds: string[]
  schemasReconciled: boolean
  // Afgeleide "primaire" (meest recente zichtbare) — backwards-compat voor
  // schrijf-routing en gating in bestaande schermen.
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
  setSchemaVisible: (id: string, visible: boolean) => Promise<void>
  archiveSchemaById: (id: string, archived?: boolean) => Promise<void>
  setSchemaSpanById: (id: string, span: SchemaSpan) => Promise<void>
  setSchemaColorById: (id: string, color: string | null) => Promise<void>
  backfillSpans: () => Promise<void>
  // Compat-aliassen (worden in fase 4 vervangen door bovenstaande):
  activateSchemaById: (id: string, name: string) => Promise<void>
  activateImport: (schemaId: string, schemaName: string, span?: SchemaSpan) => Promise<void>
  setTab: (tab: TabName) => void
  setWeekOffset: (offset: number) => void
  setDayOffset: (offset: number) => void
  setCalDate: (year: number, month: number) => void
  setPlanWeekOffset: (offset: number) => void
  setSelectedFase: (fase: string | null) => void
}

export const useDataStore = create<DataStore>((set, get) => ({
  activities: [],
  races: [],
  prs: [],

  schemaList: [],
  visibleSchemaIds: [],
  schemasReconciled: false,
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
      schemaList: [], visibleSchemaIds: [], schemasReconciled: false,
      schemaId: null, schemaName: null,
    })
    await AsyncStorage.multiRemove([VISIBLE_IDS_KEY, ...LEGACY_KEYS])
  },
  hydrateSchema: async () => {
    // Optimistische cache: alleen toepassen zolang de server nog niet heeft
    // gereconcilieerd (anders zou een late hydrate de server-waarheid overschrijven).
    if (get().schemasReconciled || get().visibleSchemaIds.length) return
    const stored = await AsyncStorage.getItem(VISIBLE_IDS_KEY)
    if (!stored) return
    try {
      const ids = JSON.parse(stored) as string[]
      if (Array.isArray(ids) && ids.length && !get().schemasReconciled) {
        // Namen kennen we nog niet (komen uit loadMySchemas); primaire id = eerste.
        set({ visibleSchemaIds: ids, schemaId: ids[0] ?? null })
      }
    } catch {
      // corrupte cache negeren; loadMySchemas herstelt de waarheid
    }
  },

  loadMySchemas: async () => {
    const list = await getMySchemas()
    const schemaList: SchemaMeta[] = list.map(s => ({
      id: s.id,
      name: s.name,
      isVisible: s.isVisible,
      isArchived: s.isArchived,
      startDate: s.startDate,
      weekCount: s.weekCount,
      color: s.color,
      createdAt: s.createdAt,
    }))
    const d = derive(schemaList)
    set({ schemaList, schemasReconciled: true, ...d })
    await persistVisible(d.visibleSchemaIds)
  },

  setSchemaSpanById: async (id, span) => {
    await setSchemaSpan(id, span)
    const schemaList = get().schemaList.map(s =>
      s.id === id ? { ...s, startDate: span.startDate, weekCount: span.weekCount } : s,
    )
    set({ schemaList })
  },

  setSchemaColorById: async (id, color) => {
    await setSchemaColor(id, color)
    const schemaList = get().schemaList.map(s =>
      s.id === id ? { ...s, color } : s,
    )
    set({ schemaList })
  },

  // Eenmalige backfill van legacy-schema's (weekCount == null): leid de span af uit
  // de geladen activiteiten en sla die op, zodat een bestaand plan ook een vaste span
  // krijgt. Alleen voor schema's waarvan activiteiten in de store staan (= zichtbaar);
  // de rest valt aan de leeskant terug op effectiveSpan. Idempotent per sessie.
  backfillSpans: async () => {
    const { schemaList, activities } = get()
    const todo = schemaList.filter(
      s => s.weekCount == null && !s.isArchived &&
        !backfillInFlight.has(s.id) &&
        activities.some(a => a.schemaId === s.id),
    )
    if (!todo.length) return
    for (const s of todo) {
      const sp = effectiveSpan(activities, s)
      if (sp.stored || sp.weeks < 1) continue
      backfillInFlight.add(s.id)
      try {
        const span: SchemaSpan = { startDate: sp.start, weekCount: sp.weeks }
        await setSchemaSpan(s.id, span)
        set(state => ({
          schemaList: state.schemaList.map(x =>
            x.id === s.id ? { ...x, startDate: span.startDate, weekCount: span.weekCount } : x,
          ),
        }))
      } catch {
        backfillInFlight.delete(s.id) // mislukt → volgende keer opnieuw proberen
      }
    }
  },

  setSchemaVisible: async (id, visible) => {
    await setSchemaVisibility(id, visible) // backend = bron van waarheid
    const schemaList = get().schemaList.map(s =>
      s.id === id ? { ...s, isVisible: visible } : s,
    )
    const d = derive(schemaList)
    set({ schemaList, ...d })
    await persistVisible(d.visibleSchemaIds)
  },

  archiveSchemaById: async (id, archived = true) => {
    await archiveSchema(id, archived)
    const schemaList = get().schemaList.map(s =>
      s.id === id
        ? { ...s, isArchived: archived, ...(archived ? { isVisible: false } : {}) }
        : s,
    )
    const d = derive(schemaList)
    set({ schemaList, ...d })
    await persistVisible(d.visibleSchemaIds)
  },

  // Compat: "actief maken" betekent nu "zichtbaar maken".
  activateSchemaById: async (id, _name) => {
    await get().setSchemaVisible(id, true)
  },

  // Compat: na een import het nieuwe schema zichtbaar toevoegen (zonder de
  // andere zichtbare schema's te raken — multi-schema tijdlijn).
  activateImport: async (schemaId, schemaName, span) => {
    if (!schemaId) return
    const existing = get().schemaList
    const found = existing.some(s => s.id === schemaId)
    const schemaList: SchemaMeta[] = found
      ? existing.map(s =>
          s.id === schemaId
            ? {
                ...s,
                name: schemaName,
                isVisible: true,
                isArchived: false,
                ...(span ? { startDate: span.startDate, weekCount: span.weekCount } : {}),
              }
            : s,
        )
      : [
          ...existing,
          {
            id: schemaId,
            name: schemaName,
            isVisible: true,
            isArchived: false,
            startDate: span?.startDate ?? null,
            weekCount: span?.weekCount ?? null,
            color: null,
            createdAt: new Date().toISOString(),
          },
        ]
    const d = derive(schemaList)
    set({ schemaList, ...d })
    await persistVisible(d.visibleSchemaIds)
  },

  setTab: (currentTab) => set({ currentTab }),
  setWeekOffset: (weekOffset) => set({ weekOffset }),
  setDayOffset: (dayOffset) => set({ dayOffset }),
  setCalDate: (calYear, calMonth) => set({ calYear, calMonth }),
  setPlanWeekOffset: (planWeekOffset) => set({ planWeekOffset }),
  setSelectedFase: (selectedFase) => set({ selectedFase }),
}))
