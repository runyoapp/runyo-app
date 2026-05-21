import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock sheets and activities so the tests stay pure
vi.mock('../sheets', () => ({
  deleteActivity: vi.fn(async () => {}),
  updateAndSort: vi.fn(async () => {}),
}))

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
    rowIndex: null,
  })),
  deleteActivity: vi.fn(async () => {}),
}))

import { deleteActivity as mockDeleteBackend, patchActivity as mockPatch } from '../activities'
import { deleteActivity as mockDeleteSheet, updateAndSort as mockUpdateAndSort } from '../sheets'
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
  it('returns null when all Sheets fields are present', () => {
    expect(validateDeleteContext(true, 'sheet-1', 42, null)).toBeNull()
  })

  it('returns an error when Sheets row is missing sheetId', () => {
    expect(validateDeleteContext(true, null, 42, null)).toBe('Geen schema gekoppeld')
  })

  it('returns an error when Sheets row is missing sheetTabId', () => {
    expect(validateDeleteContext(true, 'sheet-1', null, null)).toBe('Geen schema gekoppeld')
  })

  it('returns null when backend row has a schemaId', () => {
    expect(validateDeleteContext(false, null, null, 'schema-abc')).toBeNull()
  })

  it('returns an error when backend row has no schemaId', () => {
    expect(validateDeleteContext(false, null, null, null)).toBe('Geen schema gekoppeld')
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
  it('calls deleteSheetActivity with (sheetId, sheetTabId, token, rowIndex - 1) for Sheets rows', async () => {
    const act = makeActivity({ rowIndex: 5 })
    await commitDelete(act, {
      isSheetsRow: true,
      sheetId: 'sheet-1',
      sheetTabId: 42,
      tabName: 'Schema',
      schemaId: '',
      getToken,
    })
    expect(mockDeleteSheet).toHaveBeenCalledWith('sheet-1', 42, MOCK_TOKEN, 4)
  })

  it('calls deleteBackendActivity with (schemaId, activityId) for backend rows', async () => {
    const act = makeActivity({ rowIndex: null })
    await commitDelete(act, {
      isSheetsRow: false,
      sheetId: '',
      sheetTabId: 0,
      tabName: 'Schema',
      schemaId: 'schema-abc',
      getToken,
    })
    expect(mockDeleteBackend).toHaveBeenCalledWith('schema-abc', 'act-1')
  })

  it('throws when getToken returns null on a Sheets row', async () => {
    const act = makeActivity({ rowIndex: 5 })
    const noToken = vi.fn(async () => null)
    await expect(
      commitDelete(act, {
        isSheetsRow: true,
        sheetId: 'sheet-1',
        sheetTabId: 42,
        tabName: 'Schema',
        schemaId: '',
        getToken: noToken,
      }),
    ).rejects.toThrow('unauthorized')
  })
})

// ── markAsRest ────────────────────────────────────────────────────────────────

describe('markAsRest', () => {
  it('calls updateAndSort with type rest for Sheets rows and returns updated activity', async () => {
    const act = makeActivity({ rowIndex: 3, type: 'run', titel: 'Easy', km: 8 })
    const result = await markAsRest(act, {
      isSheetsRow: true,
      sheetId: 'sheet-1',
      sheetTabId: 42,
      tabName: 'Schema',
      schemaId: '',
      getToken,
    })
    expect(mockUpdateAndSort).toHaveBeenCalledWith(
      'sheet-1', 'Schema', 42, MOCK_TOKEN, 3,
      { type: 'rest', titel: '', km: null, detail: '' },
    )
    expect(result.type).toBe('rest')
    expect(result.titel).toBe('')
    expect(result.km).toBeNull()
  })

  it('calls patchActivity with type rest for backend rows and returns updated activity', async () => {
    const act = makeActivity({ rowIndex: null, type: 'run', id: 'act-42' })
    const result = await markAsRest(act, {
      isSheetsRow: false,
      sheetId: '',
      sheetTabId: null,
      tabName: 'Schema',
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
