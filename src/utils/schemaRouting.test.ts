import { describe, it, expect } from 'vitest'
import { effectiveSpan, schemaPeriod, pickSchemaForDate } from './schemaRouting'
import type { Activity } from '@/types/activity'
import type { SchemaMeta } from '@/stores/dataStore'

function act(p: Partial<Activity>): Activity {
  return {
    id: 'a', schemaId: 's1', datum: '2026-01-05', type: 'run', titel: '', detail: '',
    km: null, feedback: null, fase: null, rating: null, updatedAt: '', createdAt: '',
    raceType: null, goalTime: null, isMainGoal: false, rowIndex: null,
    targetPace: null, targetHr: null, intervals: null, ...p,
  }
}
function schema(p: Partial<SchemaMeta> = {}): SchemaMeta {
  return {
    id: 's1', name: '', isVisible: true, isArchived: false,
    startDate: null, weekCount: null, color: null, createdAt: '2026-01-05T00:00:00Z', ...p,
  }
}

describe('effectiveSpan — opgeslagen span', () => {
  it('start = de maandag, weken = weekCount als ondergrens', () => {
    const acts = [act({ datum: '2026-01-05' }), act({ datum: '2026-01-19', type: 'race' })]
    const sp = effectiveSpan(acts, schema({ startDate: '2026-01-05', weekCount: 12 }))
    expect(sp.stored).toBe(true)
    expect(sp.start).toBe('2026-01-05')
    expect(sp.weeks).toBe(12) // race in week 3 verkort niet
  })

  it('rekt op tot een latere activiteit (ondergrens), nooit korter', () => {
    const acts = [act({ datum: '2026-01-05' }), act({ datum: '2026-04-06' })] // week 14
    const sp = effectiveSpan(acts, schema({ startDate: '2026-01-05', weekCount: 12 }))
    expect(sp.weeks).toBe(14)
  })

  it('verankert een niet-maandag startDate op de maandag', () => {
    const sp = effectiveSpan([], schema({ startDate: '2026-01-07', weekCount: 8 })) // wo
    expect(sp.start).toBe('2026-01-05') // maandag van die week
    expect(sp.weeks).toBe(8)
  })
})

describe('effectiveSpan — legacy (afgeleid)', () => {
  it('start = eerste training (race telt niet als beginpunt)', () => {
    const acts = [act({ datum: '2026-02-02' }), act({ datum: '2026-01-10', type: 'race' })]
    const sp = effectiveSpan(acts, schema())
    expect(sp.stored).toBe(false)
    expect(sp.start).toBe('2026-02-02') // maandag; de eerdere race verschuift de start niet
  })

  it('alleen een race → die race is het ankerpunt', () => {
    const acts = [act({ datum: '2026-03-28', type: 'race' })]
    const sp = effectiveSpan(acts, schema())
    expect(sp.start).toBe('2026-03-23') // maandag van de racedatum
    expect(sp.weeks).toBe(1)
  })

  it('schemaPeriod geeft start+eind uit de span', () => {
    const acts = [act({ datum: '2026-01-05' }), act({ datum: '2026-01-18' })]
    const { start, end } = schemaPeriod(acts, schema())
    expect(start).toBe('2026-01-05')
    expect(end).toBe('2026-01-18') // zondag van week 2
  })
})

describe('pickSchemaForDate', () => {
  const sA = schema({ id: 'A', startDate: '2026-01-05', weekCount: 4 }) // 05 jan – 01 feb
  const sB = schema({ id: 'B', startDate: '2026-02-02', weekCount: 4 }) // 02 feb – 01 mrt

  it('datum in precies één schema → one', () => {
    const r = pickSchemaForDate('2026-01-12', [sA, sB], [])
    expect(r).toEqual({ kind: 'one', schemaId: 'A' })
  })

  it('datum buiten alle spans → meest recente zichtbare', () => {
    const r = pickSchemaForDate('2026-06-01', [sA, sB], [])
    expect(r.kind).toBe('one')
  })

  it('geen zichtbaar schema → none', () => {
    const r = pickSchemaForDate('2026-01-12', [schema({ isVisible: false })], [])
    expect(r).toEqual({ kind: 'none' })
  })

  it('overlappende spans → ambiguous', () => {
    const overlapA = schema({ id: 'A', startDate: '2026-01-05', weekCount: 8 })
    const overlapB = schema({ id: 'B', startDate: '2026-01-19', weekCount: 8 })
    const r = pickSchemaForDate('2026-01-26', [overlapA, overlapB], [])
    expect(r.kind).toBe('ambiguous')
  })
})
