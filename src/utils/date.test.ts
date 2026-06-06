import { describe, it, expect } from 'vitest'
import {
  mondayIndex,
  toDateString,
  fromDateString,
  addDays,
  weekStart,
  raceCountdown,
} from './date'

describe('raceCountdown', () => {
  const inDays = (n: number) => toDateString(addDays(new Date(), n))

  it('toont vandaag op dag 0', () => {
    expect(raceCountdown(inDays(0))).toEqual({ val: 'vandaag', unit: '🏁' })
  })
  it('toont dagen onder 3 weken', () => {
    expect(raceCountdown(inDays(1))).toEqual({ val: '1', unit: 'dag' })
    expect(raceCountdown(inDays(6))).toEqual({ val: '6', unit: 'dagen' })
    expect(raceCountdown(inDays(20))).toEqual({ val: '20', unit: 'dagen' })
  })
  it('toont weken van 3 t/m 7 weken (voluit)', () => {
    expect(raceCountdown(inDays(21))).toEqual({ val: '3', unit: 'weken' })
    expect(raceCountdown(inDays(49))).toEqual({ val: '7', unit: 'weken' })
  })
  it('toont maanden boven 7 weken', () => {
    expect(raceCountdown(inDays(50))).toEqual({ val: '2', unit: 'maanden' })
    expect(raceCountdown(inDays(90))).toEqual({ val: '3', unit: 'maanden' })
  })
  it('toont verleden met geleden', () => {
    expect(raceCountdown(inDays(-1))).toEqual({ val: '1', unit: 'dag geleden' })
    expect(raceCountdown(inDays(-3))).toEqual({ val: '3', unit: 'dagen geleden' })
  })
})

describe('mondayIndex', () => {
  it('returns 0 for Monday', () => {
    expect(mondayIndex(new Date(2026, 0, 5))).toBe(0)
  })

  it('returns 6 for Sunday', () => {
    expect(mondayIndex(new Date(2026, 0, 11))).toBe(6)
  })

  it('returns 2 for Wednesday', () => {
    expect(mondayIndex(new Date(2026, 0, 7))).toBe(2)
  })
})

describe('toDateString / fromDateString', () => {
  it('round-trips a YYYY-MM-DD value', () => {
    const s = '2026-03-15'
    expect(toDateString(fromDateString(s))).toBe(s)
  })

  it('pads single-digit month and day', () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('handles year-end correctly', () => {
    expect(toDateString(new Date(2025, 11, 31))).toBe('2025-12-31')
  })
})

describe('addDays', () => {
  it('adds days across month boundary', () => {
    const result = addDays(new Date(2026, 0, 30), 5)
    expect(toDateString(result)).toBe('2026-02-04')
  })

  it('crosses spring DST switch in NL (last Sunday of March)', () => {
    const result = addDays(new Date(2026, 2, 29, 12, 0, 0), 1)
    expect(toDateString(result)).toBe('2026-03-30')
  })

  it('handles negative offsets across year boundary', () => {
    const result = addDays(new Date(2026, 0, 1), -1)
    expect(toDateString(result)).toBe('2025-12-31')
  })
})

describe('weekStart', () => {
  it('returns Monday for a Wednesday in the same week', () => {
    const wed = new Date(2026, 0, 7)
    expect(toDateString(weekStart(wed))).toBe('2026-01-05')
  })

  it('returns the same date for a Monday', () => {
    const mon = new Date(2026, 0, 5)
    expect(toDateString(weekStart(mon))).toBe('2026-01-05')
  })

  it('returns the previous Monday for a Sunday', () => {
    const sun = new Date(2026, 0, 11)
    expect(toDateString(weekStart(sun))).toBe('2026-01-05')
  })
})
