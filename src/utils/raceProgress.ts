import type { Activity } from '@/types/activity'
import type { SchemaMeta } from '@/stores/dataStore'
import { schemaPeriod } from '@/utils/schemaRouting'
import { fromDateString, weekStart } from '@/utils/date'

const DAY = 86400000

// Doeltijd ("1:45:00" of "37:30") → totaal seconden. 0 = leeg/onleesbaar.
export function parseGoalSeconds(goal: string | null): number {
  if (!goal) return 0
  const parts = goal.split(':').map(p => parseInt(p.trim(), 10))
  if (parts.some(n => Number.isNaN(n))) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

// Afgeleid tempo (m:ss per km) uit doeltijd + afstand. null als niet te bepalen.
export function derivePace(goalTime: string | null, km: number | null): string | null {
  if (!km || km <= 0) return null
  const sec = parseGoalSeconds(goalTime)
  if (!sec) return null
  const per = sec / km
  let m = Math.floor(per / 60)
  let s = Math.round(per % 60)
  if (s === 60) { m += 1; s = 0 }
  return `${m}:${String(s).padStart(2, '0')}`
}

export type WeekProgress = { done: number; total: number; taper: boolean }

// Trainingsweek-voortgang richting een race, afgeleid uit het schema waar de
// race bij hoort: eerste training (maandag-verankerd) → racedatum = totaal weken;
// start → vandaag = verstreken weken. taper = laatste ~2 weken.
// null als er geen zinnig trainingsblok is (< 2 of > 52 weken, of schema onbekend).
export function weekProgress(
  race: Activity,
  schemaList: SchemaMeta[],
  activities: Activity[],
  today: Date = new Date(),
): WeekProgress | null {
  const schema = schemaList.find(s => s.id === race.schemaId)
  if (!schema) return null

  const { start } = schemaPeriod(activities, schema)
  const startMon = weekStart(fromDateString(start))
  const raceD = fromDateString(race.datum)

  const total = Math.ceil((raceD.getTime() - startMon.getTime()) / DAY / 7)
  if (total < 2 || total > 52) return null

  const t = new Date(today); t.setHours(12, 0, 0, 0)
  const elapsed = Math.floor((t.getTime() - startMon.getTime()) / DAY / 7) + 1
  const done = Math.max(1, Math.min(elapsed, total))

  return { done, total, taper: total - done <= 1 }
}
