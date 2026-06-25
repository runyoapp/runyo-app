import { describe, it, expect } from 'vitest'
import { buildReviewWeeks, reviewTotals, nextTraining, overlapCount, existingActiveDates } from '../reviewModel'
import type { ParsedRow } from '@/services/import'

const row = (datum: string, type: string, titel = '', km: number | null = null, needsCheck = false): ParsedRow => ({
  datum, type, titel, detail: '', km, fase: '', ...(needsCheck ? { needsCheck: true } : {}),
})

describe('buildReviewWeeks', () => {
  it('groups rows into Monday-aligned calendar weeks', () => {
    // 2026-09-01 is een dinsdag → week 1 verankert op maandag 2026-08-31.
    const rows: ParsedRow[] = [
      row('2026-09-01', 'run', 'Easy', 10),     // di, week 1
      row('2026-09-03', 'run', 'Interval', 9),  // do, week 1
      row('2026-09-07', 'run', 'Long', 18),     // ma, week 2
      row('2026-09-08', 'run', 'Easy', 11),     // di, week 2
    ]
    const weeks = buildReviewWeeks(rows, '2026-09-01')
    expect(weeks).toHaveLength(2)
    expect(weeks[0].num).toBe(1)
    expect(weeks[0].days).toHaveLength(7)
    // week 1 = ma 31 aug t/m zo 6 sep → alleen di + do zijn trainingen
    expect(weeks[0].trainingCount).toBe(2)
    expect(weeks[0].km).toBe(19)
    expect(weeks[0].days[0].isRest).toBe(true)   // ma 31 aug = gat → rust
    expect(weeks[0].days[1].titel).toBe('Easy')  // di 1 sep
    expect(weeks[1].days[0].titel).toBe('Long')  // ma 7 sep
  })

  it('returns empty for no rows', () => {
    expect(buildReviewWeeks([], '2026-09-01')).toEqual([])
  })

  it('anchors on the data, ignoring an invalid start date', () => {
    const weeks = buildReviewWeeks([row('2026-09-07', 'run', 'X', 5)], 'bad')
    expect(weeks).toHaveLength(1)
    expect(weeks[0].days[0].titel).toBe('X') // ma 7 sep = dag 0 van de week
  })

  it('carries the needsCheck flag through to the day', () => {
    // maandag → valt op dag 0 van de week
    const weeks = buildReviewWeeks([row('2026-09-07', 'run', 'X', 5, true)], '2026-09-07')
    expect(weeks[0].days[0].needsCheck).toBe(true)
  })

  it('surfaces targetPace, intervals and goalTime on the day', () => {
    const tempo: ParsedRow = {
      datum: '2026-09-07', type: 'run', titel: 'Interval', detail: '', km: 12, fase: '',
      targetPace: '4:00',
      intervals: [{ id: 'intv-0', label: null, repeat: 5, distanceKm: 1, durationMin: null, pace: '3:50', recovery: '90s' }],
    }
    const race: ParsedRow = {
      datum: '2026-09-08', type: 'race', titel: '10K', detail: '', km: 10, fase: '', goalTime: '37:30',
    }
    const day = buildReviewWeeks([tempo, race], '2026-09-07')[0].days
    expect(day[0]).toMatchObject({ targetPace: '4:00', hasIntervals: true })
    expect(day[1]).toMatchObject({ goalTime: '37:30', hasIntervals: false })
    // Een kale rust-dag heeft geen indicatoren.
    expect(day[2]).toMatchObject({ targetPace: null, hasIntervals: false, goalTime: null })
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

describe('existingActiveDates', () => {
  it('telt alleen echte trainingsdagen, geen rust/werk', () => {
    const existing = [
      { datum: '2026-09-01', type: 'run' },
      { datum: '2026-09-02', type: 'rest' },
      { datum: '2026-09-03', type: 'work' },
      { datum: '2026-09-04', type: 'strength' },
    ]
    const set = existingActiveDates(existing)
    expect([...set].sort()).toEqual(['2026-09-01', '2026-09-04'])
  })

  it('een nieuwe training op een oude rustdag telt niet als overlap', () => {
    const existing = [{ datum: '2026-09-02', type: 'rest' }]
    const rows: ParsedRow[] = [row('2026-09-02', 'run')]
    expect(overlapCount(rows, existingActiveDates(existing))).toBe(0)
  })
})
