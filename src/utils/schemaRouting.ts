import type { Activity } from '@/types/activity'
import type { SchemaMeta } from '@/stores/dataStore'
import { addDays, fromDateString, toDateString, weekStart } from '@/utils/date'

// Multi-schema routing + de vaste plan-span. effectiveSpan is dé bron van waarheid
// voor de looptijd van een schema; alle weergave (Plan, race-chip, routing) leidt
// hieruit af. YYYY-MM-DD strings zijn lexicografisch = chronologisch vergelijkbaar.

export type Period = { start: string; end: string }

// De daadwerkelijke span van een schema: maandag-start, aantal weken, eind.
// `stored` = of de span uit de opgeslagen weekCount komt (anders afgeleid = legacy).
export type EffectiveSpan = { start: string; weeks: number; end: string; stored: boolean }

const DAY = 86400000

// Aantal weken vanaf een maandag t/m de week waarin `dateStr` valt (>= 1). Het
// dagverschil wordt afgerond (beide ankers staan op 12:00) zodat een DST-overgang
// geen week wegvalt door de ~1u-afwijking in de millisecondedeling.
function weeksFromMonday(startMon: string, dateStr: string): number {
  const a = fromDateString(startMon).getTime()
  const b = weekStart(fromDateString(dateStr)).getTime()
  const days = Math.round((b - a) / DAY)
  return Math.floor(days / 7) + 1
}

function endOf(startMon: string, weeks: number): string {
  return toDateString(addDays(fromDateString(startMon), weeks * 7 - 1))
}

// De vaste plan-span. Met opgeslagen weekCount: start = die maandag, weken =
// max(weekCount, weken nodig om alle activiteiten te tonen) — de opgeslagen duur
// is een ondergrens (een race midden in het plan verkort 'm niet; een losse
// activiteit erbuiten rekt het raster op). Zonder opgeslagen span: legacy-afleiding
// uit de activiteit-datums, waarbij een race alleen als eindpunt telt, nooit als start.
export function effectiveSpan(activities: Activity[], schema: SchemaMeta): EffectiveSpan {
  const own = activities.filter(a => a.schemaId === schema.id)
  const lastDatum = own.length
    ? own.reduce((m, a) => (a.datum > m ? a.datum : m), own[0].datum)
    : null

  if (schema.startDate && schema.weekCount && schema.weekCount > 0) {
    const startMon = toDateString(weekStart(fromDateString(schema.startDate)))
    const coverWeeks = lastDatum ? weeksFromMonday(startMon, lastDatum) : 0
    const weeks = Math.max(schema.weekCount, coverWeeks)
    return { start: startMon, weeks, end: endOf(startMon, weeks), stored: true }
  }

  // Legacy: geen opgeslagen span → afleiden.
  if (!own.length) {
    const startMon = toDateString(weekStart(fromDateString(schema.createdAt.slice(0, 10))))
    return { start: startMon, weeks: 1, end: endOf(startMon, 1), stored: false }
  }
  const trainingDates = own.filter(a => a.type !== 'race').map(a => a.datum).sort()
  const allDates = own.map(a => a.datum).sort()
  const startRaw = trainingDates.length ? trainingDates[0] : allDates[0]
  const startMon = toDateString(weekStart(fromDateString(startRaw)))
  const weeks = Math.max(1, weeksFromMonday(startMon, allDates[allDates.length - 1]))
  return { start: startMon, weeks, end: endOf(startMon, weeks), stored: false }
}

export function schemaPeriod(activities: Activity[], schema: SchemaMeta): Period {
  const sp = effectiveSpan(activities, schema)
  return { start: sp.start, end: sp.end }
}

export type PickResult =
  | { kind: 'one'; schemaId: string }
  | { kind: 'ambiguous'; schemaIds: string[] }
  | { kind: 'none' }

// - datum binnen precies 1 zichtbaar schema → dat schema
// - datum binnen 2+ schema's → ambigu (UI toont een keuzelijst)
// - datum binnen geen enkel schema → meest recente zichtbare (createdAt)
// - geen zichtbaar schema → none (caller maakt er een aan)
export function pickSchemaForDate(
  datum: string,
  schemas: SchemaMeta[],
  activities: Activity[],
): PickResult {
  const visible = schemas.filter(s => s.isVisible && !s.isArchived)
  if (visible.length === 0) return { kind: 'none' }

  const candidates = visible.filter(s => {
    const { start, end } = schemaPeriod(activities, s)
    return datum >= start && datum <= end
  })
  if (candidates.length === 1) return { kind: 'one', schemaId: candidates[0].id }
  if (candidates.length > 1) return { kind: 'ambiguous', schemaIds: candidates.map(s => s.id) }

  const mostRecent = [...visible].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0]
  return { kind: 'one', schemaId: mostRecent.id }
}

// Eén schema als voorselectie voor een datum: het zichtbare schema waarvan de span
// de datum dekt; bij overlap het meest recent aangemaakte; valt de datum buiten alles
// dan het meest recente zichtbare. Null = geen zichtbaar schema (caller maakt er een aan).
export function routeSchemaId(
  datum: string,
  schemas: SchemaMeta[],
  activities: Activity[],
): string | null {
  const pick = pickSchemaForDate(datum, schemas, activities)
  if (pick.kind === 'none') return null
  if (pick.kind === 'one') return pick.schemaId
  const byRecent = pick.schemaIds
    .map(id => schemas.find(s => s.id === id)!)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return byRecent[0].id
}
