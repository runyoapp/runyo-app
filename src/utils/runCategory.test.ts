import { describe, it, expect } from 'vitest'
import { runCategory } from './runCategory'
import type { Activity } from '@/types/activity'

function act(p: Partial<Activity>): Activity {
  return {
    id: 'a', schemaId: 's1', datum: '2026-01-05', type: 'run', titel: '', detail: '',
    km: null, feedback: null, fase: null, rating: null, updatedAt: '', createdAt: '',
    raceType: null, goalTime: null, isMainGoal: false, rowIndex: null,
    targetPace: null, targetHr: null, intervals: null, ...p,
  }
}

describe('runCategory', () => {
  it('null voor niet-runs', () => {
    expect(runCategory(act({ type: 'strength' }))).toBeNull()
    expect(runCategory(act({ type: 'rest' }))).toBeNull()
  })

  it('tempo bij sleutelwoord in titel/detail', () => {
    expect(runCategory(act({ titel: 'Tempo 4x1km' }))).toBe('tempo')
    expect(runCategory(act({ detail: 'baan: 8x400m' }))).toBe('tempo')
  })

  it('tempo wanneer er intervallen zijn', () => {
    const a = act({
      km: 6,
      intervals: [{ id: 'i1', label: null, repeat: 4, distanceKm: 1, durationMin: null, pace: '4:30', recovery: '2:00' }],
    })
    expect(runCategory(a)).toBe('tempo')
  })

  it('long bij km >= 15 of "long" in tekst', () => {
    expect(runCategory(act({ km: 16 }))).toBe('long')
    expect(runCategory(act({ titel: 'Long run', km: 10 }))).toBe('long')
  })

  it('easy als fallback', () => {
    expect(runCategory(act({ titel: 'Easy run', km: 10 }))).toBe('easy')
    expect(runCategory(act({ km: 8 }))).toBe('easy')
  })

  it('tempo gaat vóór long (lange interval-sessie)', () => {
    expect(runCategory(act({ titel: 'Long tempo', km: 18 }))).toBe('tempo')
  })
})
