import { useShallow } from 'zustand/react/shallow'
import { useDataStore } from '@/stores/dataStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { toDateString, dateFromOffset, addDays, formatDayLabel } from '@/utils/date'
import type { Activity } from '@/types/activity'

export type TodayData = {
  isSignedIn: boolean
  selectedDate: Date
  dateStr: string
  dayLabel: string
  dayOffset: number
  setDayOffset: (offset: number) => void
  schemaId: string | null
  upsertActivity: (activity: Activity) => void
  activities: Activity[]
  todayRows: Activity[]
  activeRows: Activity[]
  mainRow: Activity | null
  isRest: boolean
  fbRow: Activity | null
  tmrRow: Activity | null
}

export function useTodayData(): TodayData {
  const tokenSet = useAuthStore(s => s.tokenSet)
  const lang = useSettingsStore(s => s.prefs.lang)

  const {
    dayOffset, setDayOffset,
    activities,
    schemaId,
    upsertActivity,
  } = useDataStore(
    useShallow(s => ({
      dayOffset:      s.dayOffset,
      setDayOffset:   s.setDayOffset,
      activities:     s.activities,
      schemaId:       s.schemaId,
      upsertActivity: s.upsertActivity,
    }))
  )

  const isSignedIn   = !!tokenSet
  const selectedDate = dateFromOffset(dayOffset)
  const dateStr      = toDateString(selectedDate)
  const dayLabel     = formatDayLabel(selectedDate, dayOffset, lang)

  const todayRows  = activities.filter(a => a.datum === dateStr)
  const activeRows = todayRows.filter(a => a.type !== 'rest')
  const mainRow    = activeRows[0] ?? todayRows[0] ?? null
  const isRest     = !mainRow || mainRow.type === 'rest'
  const fbRow      = activeRows.find(a => a.type !== 'work') ?? null

  const tmrDate = addDays(new Date(), 1)
  const tmrStr  = toDateString(tmrDate)
  const tmrRow  = dayOffset === 0
    ? activities.find(a => a.datum === tmrStr && a.type !== 'rest') ?? null
    : null

  return {
    isSignedIn,
    selectedDate,
    dateStr,
    dayLabel,
    dayOffset,
    setDayOffset,
    schemaId,
    upsertActivity,
    activities,
    todayRows,
    activeRows,
    mainRow,
    isRest,
    fbRow,
    tmrRow,
  }
}
