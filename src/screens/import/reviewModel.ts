// runyo — bouwt de read-only review-weergave op uit geparsede rijen.
// Pure logica (alleen date-utils) zodat de weken-indeling los te testen is.

import { fromDateString, addDays, toDateString, DAYS_NL, MONTHS_NL } from '@/utils/date'
import type { ParsedRow } from '@/services/import'

const REST_TYPES = new Set(['rest', 'recovery'])

export type ReviewDay = {
  datum: string
  label: string // bv. "ma 1"
  type: string
  titel: string
  km: number | null
  isRest: boolean
  isRace: boolean
  needsCheck: boolean
  // Geïmporteerde sessie-/race-velden — voeden de subtiele indicatoren in de DayRow.
  targetPace: string | null
  targetHr: number | null
  hasIntervals: boolean
  goalTime: string | null
}

export type ReviewWeek = {
  num: number
  range: string // bv. "ma 1 - zo 7 sep"
  km: number
  trainingCount: number
  days: ReviewDay[]
}

function dayLabel(d: Date): string {
  return `${DAYS_NL[(d.getDay() + 6) % 7].toLowerCase()} ${d.getDate()}`
}

function rangeLabel(start: Date, end: Date): string {
  const a = `${DAYS_NL[(start.getDay() + 6) % 7].toLowerCase()} ${start.getDate()}`
  const b = `${DAYS_NL[(end.getDay() + 6) % 7].toLowerCase()} ${end.getDate()} ${MONTHS_NL[end.getMonth()]}`
  return `${a} - ${b}`
}

/**
 * Groepeer de rijen in kalender-weken (maandag-zondag). We verankeren op de maandag
 * van de week van de éérste rij — niet blind op startDate — zodat de weken altijd
 * netjes uitlijnen, ook als de gekozen startdag geen maandag is. Zo verschijnt er
 * geen losse "extra week" meer wanneer een race net over een 7-daags blok valt.
 */
export function buildReviewWeeks(rows: ParsedRow[], startDate: string): ReviewWeek[] {
  if (rows.length === 0) return []

  const sorted = [...rows].sort((a, b) => a.datum.localeCompare(b.datum))
  const firstValid = sorted.find(r => !isNaN(fromDateString(r.datum).getTime()))
  const anchorDate = firstValid ? fromDateString(firstValid.datum) : fromDateString(startDate)
  if (isNaN(anchorDate.getTime())) return []

  // Terug naar de maandag van die week (0=ma … 6=zo).
  const start = addDays(anchorDate, -((anchorDate.getDay() + 6) % 7))
  const last = fromDateString(sorted[sorted.length - 1].datum)
  const spanDays = Math.max(0, Math.round((last.getTime() - start.getTime()) / 86_400_000))
  const weekCount = Math.floor(spanDays / 7) + 1

  const byDate = new Map<string, ParsedRow>()
  for (const r of sorted) byDate.set(r.datum, r)

  const weeks: ReviewWeek[] = []
  for (let w = 0; w < weekCount; w++) {
    const wStart = addDays(start, w * 7)
    const wEnd = addDays(start, w * 7 + 6)
    const days: ReviewDay[] = []
    let km = 0
    let trainingCount = 0
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, w * 7 + i)
      const iso = toDateString(d)
      const row = byDate.get(iso)
      const type = row?.type ?? 'rest'
      const isRest = REST_TYPES.has(type)
      const isRace = type === 'race'
      if (row && !isRest) {
        trainingCount++
        km += row.km ?? 0
      }
      days.push({
        datum: iso,
        label: dayLabel(d),
        type,
        titel: row?.titel || (isRest ? 'Rust' : ''),
        km: row?.km ?? null,
        isRest,
        isRace,
        needsCheck: !!row?.needsCheck,
        targetPace: row?.targetPace ?? null,
        targetHr: row?.targetHr ?? null,
        hasIntervals: !!(row?.intervals && row.intervals.length > 0),
        goalTime: row?.goalTime ?? null,
      })
    }
    weeks.push({ num: w + 1, range: rangeLabel(wStart, wEnd), km, trainingCount, days })
  }
  return weeks
}

export type ReviewTotals = { weeks: number; trainings: number; km: number }

export function reviewTotals(weeks: ReviewWeek[]): ReviewTotals {
  return {
    weeks: weeks.length,
    trainings: weeks.reduce((s, w) => s + w.trainingCount, 0),
    km: weeks.reduce((s, w) => s + w.km, 0),
  }
}

// Eerstvolgende echte training vanaf vandaag (voor het Klaar-scherm).
export function nextTraining(rows: ParsedRow[], todayIso: string): ParsedRow | null {
  const upcoming = rows
    .filter(r => !REST_TYPES.has(r.type) && r.datum >= todayIso)
    .sort((a, b) => a.datum.localeCompare(b.datum))
  return upcoming[0] ?? null
}

// Aantal datums dat al een (niet-rust) activiteit had in het bestaande schema.
export function overlapCount(rows: ParsedRow[], existingDates: Set<string>): number {
  return rows.filter(r => existingDates.has(r.datum) && !REST_TYPES.has(r.type)).length
}
