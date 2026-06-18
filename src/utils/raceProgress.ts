import type { Activity } from '@/types/activity'
import type { SchemaMeta } from '@/stores/dataStore'
import { effectiveSpan } from '@/utils/schemaRouting'
import { fromDateString } from '@/utils/date'

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

// Plan-voortgang richting een race, afgeleid uit de vaste span van het schema waar
// de race bij hoort: totaal = de opgeslagen weekduur (effectiveSpan.weeks), niet de
// afstand tot de racedatum — zo verschuift een race midden in het plan het totaal
// niet. done = verstreken weken sinds de maandag-start. taper = laatste ~2 weken.
// Bij een legacy-schema (afgeleide span) blijft de < 2 / > 52 weken sanity-guard
// gelden; een opgeslagen span vertrouwen we (door de gebruiker gereviewd).
export function weekProgress(
  race: Activity,
  schemaList: SchemaMeta[],
  activities: Activity[],
  today: Date = new Date(),
): WeekProgress | null {
  const schema = schemaList.find(s => s.id === race.schemaId)
  if (!schema) return null

  const span = effectiveSpan(activities, schema)
  const startMon = fromDateString(span.start)
  const total = span.weeks
  if (!span.stored && (total < 2 || total > 52)) return null

  const t = new Date(today); t.setHours(12, 0, 0, 0)
  // Dagverschil afronden (beide op 12:00) zodat een DST-overgang geen week verschuift.
  const elapsedDays = Math.round((t.getTime() - startMon.getTime()) / DAY)
  const elapsed = Math.floor(elapsedDays / 7) + 1
  const done = Math.max(1, Math.min(elapsed, total))

  return { done, total, taper: total - done <= 1 }
}
