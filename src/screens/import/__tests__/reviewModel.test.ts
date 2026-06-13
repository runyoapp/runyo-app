import { describe, it, expect } from 'vitest'
import { buildReviewWeeks, reviewTotals, nextTraining, overlapCount } from '../reviewModel'
import type { ParsedRow } from '@/services/import'

const row = (datum: string, type: string, titel = '', km: number | null = null, needsCheck = false): ParsedRow => ({
  datum, type, titel, detail: '', km, fase: '', ...(needsCheck ? { needsCheck: true } : {}),
})

describe('buildReviewWeeks', () => {
  it('groups rows into 7-day weeks from the start date', () => {
    const rows: ParsedRow[] = [
      row('2026-09-01', 'run', 'Easy', 10),
      row('2026-09-03', 'run', 'Interval', 9),
      row('2026-09-07', 'run', 'Long', 18),
      row('2026-09-08', 'run', 'Easy', 11), // week 2
    ]
    const weeks = buildReviewWeeks(rows, '2026-09-01')
    expect(weeks).toHaveLength(2)
    expect(weeks[0].num).toBe(1)
    expect(weeks[0].days).toHaveLength(7)
    expect(weeks[0].trainingCount).toBe(3)
    expect(weeks[0].km).toBe(37)
    // gaten worden rust
    expect(weeks[0].days[1].isRest).toBe(true)
    expect(weeks[1].days[0].titel).toBe('Easy')
  })

  it('returns empty for no rows or invalid date', () => {
    expect(buildReviewWeeks([], '2026-09-01')).toEqual([])
    expect(buildReviewWeeks([row('2026-09-01', 'run')], 'bad')).toEqual([])
  })

  it('carries the needsCheck flag through to the day', () => {
    const weeks = buildReviewWeeks([row('2026-09-01', 'run', 'X', 5, true)], '2026-09-01')
    expect(weeks[0].days[0].needsCheck).toBe(true)
  })
})

describe('reviewTotals', () => {
  it('sums weeks, trainings and km', () => {
    const rows: ParsedRow[] = [row('2026-09-01', 'run', 'A', 10), row('2026-09-02', 'rest'), row('2026-09-08', 'run', 'B', 12)]
    const totals = reviewTotals(buildReviewWeeks(rows, '2026-09-01'))
    expect(totals.weeks).toBe(2)
    expect(totals.trainings).toBe(2)
    expect(totals.km).toBe(22)
  })
})

describe('nextTraining', () => {
  it('returns the first non-rest activity on or after today', () => {
    const rows: ParsedRow[] = [row('2026-09-01', 'run', 'Past'), row('2026-09-10', 'rest'), row('2026-09-11', 'run', 'Next', 8)]
    expect(nextTraining(rows, '2026-09-09')?.titel).toBe('Next')
  })
  it('returns null when nothing is upcoming', () => {
    expect(nextTraining([row('2026-09-01', 'run')], '2026-12-01')).toBeNull()
  })
})

describe('overlapCount', () => {
  it('counts non-rest rows whose date already exists', () => {
    const rows: ParsedRow[] = [row('2026-09-01', 'run'), row('2026-09-02', 'rest'), row('2026-09-03', 'run')]
    expect(overlapCount(rows, new Set(['2026-09-01', '2026-09-02']))).toBe(1)
  })
})
