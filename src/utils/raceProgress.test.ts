import { describe, it, expect } from 'vitest'
import { parseGoalSeconds, derivePace, weekProgress } from './raceProgress'
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
  return { id: 's1', name: '', isVisible: true, isArchived: false, createdAt: '2026-01-05T00:00:00Z', ...p }
}

describe('parseGoalSeconds', () => {
  it('h:mm:ss', () => expect(parseGoalSeconds('1:45:00')).toBe(6300))
  it('mm:ss', () => expect(parseGoalSeconds('37:30')).toBe(2250))
  it('leeg / null', () => { expect(parseGoalSeconds(null)).toBe(0); expect(parseGoalSeconds('')).toBe(0) })
  it('onleesbaar', () => expect(parseGoalSeconds('snel')).toBe(0))
})

describe('derivePace', () => {
  it('1:45:00 over 22 km → 4:46', () => expect(derivePace('1:45:00', 22)).toBe('4:46'))
  it('37:30 over 10 km → 3:45', () => expect(derivePace('37:30', 10)).toBe('3:45'))
  it('geen afstand → null', () => expect(derivePace('37:30', null)).toBeNull())
  it('geen doeltijd → null', () => expect(derivePace(null, 10)).toBeNull())
})

describe('weekProgress', () => {
  const acts = [act({ datum: '2026-01-05' }), act({ datum: '2026-03-28', type: 'race' })]
  const race = acts[1]

  it('rekent totaal weken uit start → race en verstreken vanaf vandaag', () => {
    const p = weekProgress(race, [schema()], acts, new Date('2026-01-05T12:00:00'))
    expect(p).not.toBeNull()
    expect(p!.total).toBe(12)
    expect(p!.done).toBe(1)
    expect(p!.taper).toBe(false)
  })

  it('taper in de laatste weken', () => {
    const p = weekProgress(race, [schema()], acts, new Date('2026-03-23T12:00:00'))
    expect(p!.taper).toBe(true)
  })

  it('null als het schema onbekend is', () => {
    expect(weekProgress(race, [], acts)).toBeNull()
  })

  it('null bij een blok korter dan 2 weken', () => {
    const a2 = [act({ datum: '2026-01-05' }), act({ datum: '2026-01-08', type: 'race' })]
    expect(weekProgress(a2[1], [schema()], a2, new Date('2026-01-05T12:00:00'))).toBeNull()
  })
})
