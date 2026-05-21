import { describe, it, expect, vi } from 'vitest'
import type { Activity } from '@/types/activity'

vi.mock('@/constants/activities', () => ({
  TYPE_NL_MAP: {} as Record<string, string>,
}))

const { activitiesToSheetRows } = await import('../sheets')

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id:        'act-1',
    datum:     '2025-03-01',
    type:      'run',
    titel:     'Rustige duurloop',
    detail:    '5x400m',
    km:        10,
    feedback:  null,
    fase:      'Opbouw',
    rating:    null,
    updatedAt: '2025-03-01T08:00:00Z',
    createdAt: '2025-03-01T08:00:00Z',
    raceType:  null,
    rowIndex:  null,
    ...overrides,
  }
}

describe('activitiesToSheetRows', () => {
  it('converts a single activity to a row with 11 columns', () => {
    const rows = activitiesToSheetRows([makeActivity()])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveLength(11)
  })

  it('maps fields to the correct column positions', () => {
    const a = makeActivity({ datum: '2025-04-10', type: 'strength', titel: 'Kracht', km: 0 })
    const [row] = activitiesToSheetRows([a])
    expect(row[0]).toBe('2025-04-10')   // datum
    expect(row[1]).toBe('strength')      // type
    expect(row[2]).toBe('Kracht')        // titel
    expect(row[4]).toBe('0')             // km — always string
  })

  it('sorts activities by datum ascending', () => {
    const a1 = makeActivity({ id: 'a1', datum: '2025-03-10' })
    const a2 = makeActivity({ id: 'a2', datum: '2025-03-01' })
    const a3 = makeActivity({ id: 'a3', datum: '2025-03-05' })
    const rows = activitiesToSheetRows([a1, a2, a3])
    expect(rows.map(r => r[0])).toEqual(['2025-03-01', '2025-03-05', '2025-03-10'])
  })

  it('converts null km to empty string', () => {
    const [row] = activitiesToSheetRows([makeActivity({ km: null })])
    expect(row[4]).toBe('')
  })

  it('converts null feedback to empty string', () => {
    const [row] = activitiesToSheetRows([makeActivity({ feedback: null })])
    expect(row[5]).toBe('')
  })

  it('returns empty array for empty input', () => {
    expect(activitiesToSheetRows([])).toEqual([])
  })

  it('does not mutate the original array', () => {
    const a1 = makeActivity({ id: 'a1', datum: '2025-03-10' })
    const a2 = makeActivity({ id: 'a2', datum: '2025-03-01' })
    const original = [a1, a2]
    activitiesToSheetRows(original)
    expect(original[0].id).toBe('a1')
  })
})
