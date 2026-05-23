import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock-refs zodat de vi.mock factory ze kan gebruiken zonder xlsx te importeren.
const { xlsxRead, xlsxSheetToCsv } = vi.hoisted(() => ({
  xlsxRead: vi.fn(),
  xlsxSheetToCsv: vi.fn(),
}))

vi.mock('xlsx', () => ({
  default: { read: xlsxRead, utils: { sheet_to_csv: xlsxSheetToCsv } },
  read: xlsxRead,
  utils: { sheet_to_csv: xlsxSheetToCsv },
}))

vi.mock('../schemas', () => ({
  createSchema: vi.fn(),
}))

vi.mock('../activities', () => ({
  createActivity: vi.fn(),
}))

vi.mock('../auth', () => ({
  BACKEND: 'https://runyo-auth-production.up.railway.app',
  getAccessToken: vi.fn(async () => 'test-token'),
}))

vi.mock('../sheets', () => ({}))
vi.mock('../drive', () => ({}))
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }))
vi.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
}))
vi.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: vi.fn(),
  EncodingType: { Base64: 'base64' },
}))

import { createSchema } from '../schemas'
import { createActivity } from '../activities'
import {
  excelToText,
  analyseSchema,
  analyseSchemaFromUrl,
  importToBackend,
  IMPORT_BACKEND,
  SYSTEM_PROMPT,
} from '../import'
import type { ParsedRow } from '../import'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  fetchMock.mockReset()
  vi.mocked(createSchema).mockReset()
  vi.mocked(createActivity).mockReset()
  xlsxRead.mockReset()
  xlsxSheetToCsv.mockReset()
})

// ── 1. excelToText ────────────────────────────────────────────────────────────

describe('excelToText', () => {
  it('converts base64 xlsx to CSV string via xlsx library', () => {
    const fakeSheet = { '!ref': 'A1:C2' }
    xlsxRead.mockReturnValue({ Sheets: { Sheet1: fakeSheet }, SheetNames: ['Sheet1'] })
    xlsxSheetToCsv.mockReturnValue('datum,type,titel\n2026-06-01,run,Easy run')

    const result = excelToText('FAKEB64==')

    expect(xlsxRead).toHaveBeenCalledWith('FAKEB64==', { type: 'base64' })
    expect(xlsxSheetToCsv).toHaveBeenCalledWith(fakeSheet)
    expect(result).toBe('datum,type,titel\n2026-06-01,run,Easy run')
  })
})

// ── 2. analyseSchemaFromUrl ───────────────────────────────────────────────────

describe('analyseSchemaFromUrl', () => {
  it('sends { url } in the request body to /ai/import', async () => {
    const rawResponse = 'TITEL: Test\nWEKEN: 4\nPIEK: 40 km\nRAPPORT: Prima schema.\n[{"datum":"2026-06-01","type":"run","titel":"Easy","detail":"","km":8,"fase":""}]'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: rawResponse }] }),
    })

    await analyseSchemaFromUrl(
      'https://docs.google.com/spreadsheets/d/abc/export?format=csv',
      '2026-06-01',
      [0, 2, 4],
      true,
      async () => 'tok',
      () => {},
    )

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${IMPORT_BACKEND}/ai/import`)
    const body = JSON.parse(init.body)
    expect(body.url).toBe('https://docs.google.com/spreadsheets/d/abc/export?format=csv')
    expect(body.system).toBe(SYSTEM_PROMPT)
  })
})

// ── 3. analyseSchema met xlsx mime ────────────────────────────────────────────

describe('analyseSchema (Excel mime)', () => {
  it('sends content as text block (not document) for xlsx mime', async () => {
    const fakeSheet = { '!ref': 'A1:B2' }
    xlsxRead.mockReturnValue({ Sheets: { Sheet1: fakeSheet }, SheetNames: ['Sheet1'] })
    xlsxSheetToCsv.mockReturnValue('datum,type\n2026-06-01,run')

    const rawResponse = 'TITEL: Test\nWEKEN: 4\nPIEK: 40 km\nRAPPORT: Prima.\n[{"datum":"2026-06-01","type":"run","titel":"Easy","detail":"","km":8,"fase":""}]'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: rawResponse }] }),
    })

    await analyseSchema(
      'FAKEB64==',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'test.xlsx',
      '2026-06-01',
      [0, 2, 4],
      true,
      async () => 'tok',
      () => {},
    )

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const userContent = body.messages[0].content
    expect(userContent[0].type).toBe('text')
    expect(userContent[0].text).toContain('datum,type')
  })
})

// ── 4. importToBackend error-pad ──────────────────────────────────────────────

describe('importToBackend (error)', () => {
  it('rethrows when createSchema fails', async () => {
    vi.mocked(createSchema).mockRejectedValueOnce(new Error('unauthorized'))

    const rows: ParsedRow[] = [{ datum: '2026-06-01', type: 'run', titel: 'Easy', detail: '', km: 8, fase: '' }]
    await expect(importToBackend(rows, async () => 'tok', () => {})).rejects.toThrow('unauthorized')
  })
})

// ── 5. importToBackend integration ───────────────────────────────────────────

describe('importToBackend (integration)', () => {
  it('creates schema + N activities and returns { schemaId, activities }', async () => {
    vi.mocked(createSchema).mockResolvedValueOnce({ id: 'schema-1' })
    vi.mocked(createActivity)
      .mockResolvedValueOnce({ id: 'act-1', datum: '2026-06-01', type: 'run',  titel: 'Easy',  detail: '', km: 8,    feedback: null, fase: null, rating: null, updatedAt: '', createdAt: '', raceType: null, rowIndex: null })
      .mockResolvedValueOnce({ id: 'act-2', datum: '2026-06-02', type: 'run',  titel: 'Tempo', detail: '', km: 10,   feedback: null, fase: null, rating: null, updatedAt: '', createdAt: '', raceType: null, rowIndex: null })
      .mockResolvedValueOnce({ id: 'act-3', datum: '2026-06-03', type: 'rest', titel: 'Rust',  detail: '', km: null, feedback: null, fase: null, rating: null, updatedAt: '', createdAt: '', raceType: null, rowIndex: null })

    const rows: ParsedRow[] = [
      { datum: '2026-06-01', type: 'run',  titel: 'Easy',  detail: '', km: 8,    fase: '' },
      { datum: '2026-06-02', type: 'run',  titel: 'Tempo', detail: '', km: 10,   fase: '' },
      { datum: '2026-06-03', type: 'rest', titel: 'Rust',  detail: '', km: null, fase: '' },
    ]

    const result = await importToBackend(rows, async () => 'tok', () => {})

    expect(result.schemaId).toBe('schema-1')
    expect(result.activities).toHaveLength(3)
    expect(result.activities[0].id).toBe('act-1')
    expect(createActivity).toHaveBeenCalledTimes(3)
    expect(vi.mocked(createActivity).mock.calls[0][0]).toBe('schema-1')
    expect(vi.mocked(createActivity).mock.calls[0][1]).toMatchObject({ datum: '2026-06-01', type: 'run', titel: 'Easy', km: 8 })
  })
})
