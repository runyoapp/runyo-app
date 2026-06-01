import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../activities', () => ({
  patchActivity: vi.fn(async (_schemaId: string, id: string, patch: Record<string, unknown>) => ({
    id,
    datum: '2026-06-01',
    type: patch.type ?? 'run',
    titel: patch.titel ?? '',
    detail: patch.detail ?? '',
    km: patch.km ?? null,
    feedback: null,
    fase: null,
    rating: null,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    raceType: null,
    goalTime: null,
    isMainGoal: false,
    rowIndex: null,
  })),
  deleteActivity: vi.fn(async () => {}),
}))

import { deleteActivity as mockDeleteBackend, patchActivity as mockPatch } from '../activities'
import {
  commitDelete,
  markAsRest,
  validateDeleteContext,
  validatePatchContext,
} from '../activityEdit'
import type { Activity } from '@/types/activity'

function makeActivity(over: Partial<Activity> = {}): Activity {
  return {
    id: 'act-1',
    datum: '2026-06-01',
    type: 'run',
    titel: 'Easy run',
    detail: '',
    km: 8,
    feedback: null,
    fase: null,
    rating: null,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    raceType: null,
    goalTime: null,
    isMainGoal: false,
    rowIndex: null,
    ...over,
  }
}

const MOCK_TOKEN = 'tok-123'
const getToken = vi.fn(async () => MOCK_TOKEN)

beforeEach(() => {
  vi.clearAllMocks()
})

// ── validateDeleteContext ─────────────────────────────────────────────────────

describe('validateDeleteContext', () => {
  it('returns null when a schemaId is present', () => {
    expect(validateDeleteContext('schema-abc')).toBeNull()
  })

  it('returns an error when there is no schemaId', () => {
    expect(validateDeleteContext(null)).toBe('Geen schema gekoppeld')
  })
})

// ── validatePatchContext ──────────────────────────────────────────────────────

describe('validatePatchContext', () => {
  it('is the same function as validateDeleteContext', () => {
    // They share identical validation rules — reuse is intentional
    expect(validateDeleteContext).toBe(validatePatchContext)
  })
})

// ── commitDelete ─────────────────────────────────────────────────────────────

describe('commitDelete', () => {
  it('calls deleteBackendActivity with (schemaId, activityId)', async () => {
    const act = makeActivity({ rowIndex: null })
    await commitDelete(act, {
      schemaId: 'schema-abc',
      getToken,
    })
    expect(mockDeleteBackend).toHaveBeenCalledWith('schema-abc', 'act-1')
  })
})

// ── markAsRest ────────────────────────────────────────────────────────────────

describe('markAsRest', () => {
  it('calls patchActivity with type rest and returns updated activity', async () => {
    const act = makeActivity({ rowIndex: null, type: 'run', id: 'act-42' })
    const result = await markAsRest(act, {
      schemaId: 'schema-abc',
      getToken,
    })
    expect(mockPatch).toHaveBeenCalledWith(
      'schema-abc', 'act-42',
      { type: 'rest', titel: null, km: null, detail: null },
    )
    expect(result.type).toBe('rest')
  })
})
