import type { Activity } from '@/types/activity'
import type { SchemaMeta } from '@/stores/dataStore'

// Multi-schema routing: bepaalt op basis van de datum naar welk schema een
// nieuwe training gaat. De periode van een schema is afgeleid uit de min/max
// datum van zijn activiteiten (leeg schema → valt terug op createdAt).
// YYYY-MM-DD strings zijn lexicografisch = chronologisch vergelijkbaar.

export type Period = { start: string; end: string }

export function schemaPeriod(activities: Activity[], schema: SchemaMeta): Period {
  const dates = activities
    .filter(a => a.schemaId === schema.id)
    .map(a => a.datum)
    .sort()
  if (dates.length === 0) {
    const d = schema.createdAt.slice(0, 10)
    return { start: d, end: d }
  }
  return { start: dates[0], end: dates[dates.length - 1] }
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
