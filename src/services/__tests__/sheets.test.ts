import { describe, it, expect, beforeEach, vi } from 'vitest'

// sheets.ts pulls in @/constants/activities for type normalisation.
// The alias isn't resolved in this vitest config — mock just enough.
vi.mock('@/constants/activities', () => ({
  TYPE_NL_MAP: {} as Record<string, string>,
}))

const { appendActivity, updateActivity, updateAndSort, appendAndSort } = await import('../sheets')

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  fetchMock.mockReset()
})

const SHEET = 'sheet-abc'
const TAB   = 'Schema'
const TOKEN = 'tok'

const NEW_ROW = {
  datum: '2026-06-01',
  type: 'run' as const,
  titel: 'Easy',
  detail: '',
  km: 8,
  feedback: null,
  fase: null,
  raceType: null,
  goalTime: null,
  isMainGoal: false,
}

describe('appendActivity', () => {
  it('uses valueInputOption=USER_ENTERED so Sheets parses dates as date cells', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })

    await appendActivity(SHEET, TAB, TOKEN, NEW_ROW)

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('valueInputOption=USER_ENTERED')
    expect(url).not.toContain('valueInputOption=RAW')
  })
})

describe('updateActivity', () => {
  it('uses valueInputOption=USER_ENTERED on the PUT so column A stays a date cell', async () => {
    // First fetch: read current row. Second fetch: PUT merged row.
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ values: [['2026-06-01','run','Easy','',8,'','','id1','','','']] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })

    await updateActivity(SHEET, TAB, TOKEN, 5, { titel: 'New' })

    const [putUrl, putInit] = fetchMock.mock.calls[1]
    expect(putUrl).toContain('valueInputOption=USER_ENTERED')
    expect(putInit.method).toBe('PUT')
  })
})

describe('updateAndSort', () => {
  it('issues a sortRange batchUpdate on the given tabId after the update', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ values: [['2026-06-01','run','','','','','','','','','']] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })

    await updateAndSort(SHEET, TAB, 12345, TOKEN, 5, { datum: '2026-07-01' })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const sortCall = fetchMock.mock.calls[2]
    expect(sortCall[0]).toContain(':batchUpdate')
    const body = JSON.parse(sortCall[1].body)
    expect(body.requests[0].sortRange.range.sheetId).toBe(12345)
    expect(body.requests[0].sortRange.sortSpecs[0].dimensionIndex).toBe(0)
  })

  it('falls back to looking up the tabId when null is passed', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ values: [['2026-06-01','run','','','','','','','','','']] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ sheets: [{ properties: { sheetId: 999, title: TAB } }] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })

    await updateAndSort(SHEET, TAB, null, TOKEN, 5, { titel: 'x' })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    const sortCall = fetchMock.mock.calls[3]
    const body = JSON.parse(sortCall[1].body)
    expect(body.requests[0].sortRange.range.sheetId).toBe(999)
  })
})

describe('appendAndSort', () => {
  it('appends then sorts on the resolved tabId', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ sheets: [{ properties: { sheetId: 42, title: TAB } }] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })

    await appendAndSort(SHEET, TAB, TOKEN, NEW_ROW)

    const sortCall = fetchMock.mock.calls[2]
    expect(sortCall[0]).toContain(':batchUpdate')
    const body = JSON.parse(sortCall[1].body)
    expect(body.requests[0].sortRange.range.sheetId).toBe(42)
  })
})
