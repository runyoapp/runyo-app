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
  deleteSchema: vi.fn(),
}))

vi.mock('../activities', () => ({
  createActivitiesBatch: vi.fn(),
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
vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}))
vi.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: vi.fn(),
  EncodingType: { Base64: 'base64' },
}))

import { createSchema, deleteSchema } from '../schemas'
import { createActivitiesBatch } from '../activities'
import {
  excelToText,
  EXCEL_HELP,
  analyseSchema,
  analyseSchemaFromUrl,
  importToBackend,
  parseRawResponse,
  checkFileSize,
  base64Bytes,
  IMPORT_BACKEND,
  SYSTEM_PROMPT,
} from '../import'
import type { ParsedRow } from '../import'
import type { Activity } from '@/types/activity'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  fetchMock.mockReset()
  vi.mocked(createSchema).mockReset()
  vi.mocked(deleteSchema).mockReset()
  vi.mocked(createActivitiesBatch).mockReset()
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

  it('throws the quickfix help when the workbook is unreadable (e.g. macro file)', () => {
    xlsxRead.mockImplementation(() => { throw new Error('corrupt') })
    expect(() => excelToText('FAKEB64==')).toThrow(EXCEL_HELP)
  })

  it('throws the quickfix help when the first sheet is empty', () => {
    xlsxRead.mockReturnValue({ Sheets: { Sheet1: { '!ref': 'A1' } }, SheetNames: ['Sheet1'] })
    xlsxSheetToCsv.mockReturnValue('\n,,\n,,\n')
    expect(() => excelToText('FAKEB64==')).toThrow(EXCEL_HELP)
  })
})

// ── 2. analyseSchemaFromUrl ───────────────────────────────────────────────────

describe('analyseSchemaFromUrl', () => {
  it('sends { url } in the request body to /ai/import', async () => {
    const rawResponse = 'TITEL: Test\nWEKEN: 4\nPIEK: 40 km\nRAPPORT: Prima schema.\n[{"datum":"2026-06-01","type":"run","titel":"Easy","detail":"","km":8,"fase":""}]'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => rawResponse,
    })

    await analyseSchemaFromUrl(
      'https://docs.google.com/spreadsheets/d/abc/export?format=csv',
      '2026-06-01',
      { mode: 'keep' },
      async () => 'tok',
      () => {},
    )

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${IMPORT_BACKEND}/ai/import`)
    const body = JSON.parse(init.body)
    expect(body.url).toBe('https://docs.google.com/spreadsheets/d/abc/export?format=csv')
    expect(body.system).toBe(SYSTEM_PROMPT)
  })

  it('forwards the AbortSignal to fetch so a cancel reaches the backend', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'TITEL: T\nWEKEN: 1\nPIEK: 10 km\nRAPPORT: x.\n[{"datum":"2026-06-01","type":"run","titel":"E","detail":"","km":8,"fase":""}]',
    })
    const ac = new AbortController()
    await analyseSchemaFromUrl('https://docs.google.com/spreadsheets/d/abc', '2026-06-01', { mode: 'keep' }, async () => 'tok', () => {}, ac.signal)
    expect(fetchMock.mock.calls[0][1].signal).toBe(ac.signal)
  })

  it('keep-mode userText instructs to honor the document weekdays', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'TITEL: T\nWEKEN: 1\nPIEK: 10 km\nRAPPORT: x.\n[{"datum":"2026-06-01","type":"run","titel":"E","detail":"","km":8,"fase":""}]',
    })
    await analyseSchemaFromUrl('https://docs.google.com/spreadsheets/d/abc', '2026-06-01', { mode: 'keep' }, async () => 'tok', () => {})
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const userText = body.messages[0].content.at(-1).text
    expect(userText).toContain('Begindatum: 2026-06-01')
    expect(userText).toContain('Houd de trainingsdagen')
  })

  it('choose-mode userText lists the chosen weekdays in order', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'TITEL: T\nWEKEN: 1\nPIEK: 10 km\nRAPPORT: x.\n[{"datum":"2026-06-01","type":"run","titel":"E","detail":"","km":8,"fase":""}]',
    })
    // 4=vr, 0=ma, 2=wo → moet gesorteerd als ma, wo, vr verschijnen.
    await analyseSchemaFromUrl('https://docs.google.com/spreadsheets/d/abc', '2026-06-01', { mode: 'choose', days: [4, 0, 2] }, async () => 'tok', () => {})
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const userText = body.messages[0].content.at(-1).text
    expect(userText).toContain('maandag, woensdag, vrijdag')
    expect(userText).toContain('Negeer de weekdagen uit het document')
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
      text: async () => rawResponse,
    })

    await analyseSchema(
      'FAKEB64==',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'test.xlsx',
      '2026-06-01',
      { mode: 'keep' },
      async () => 'tok',
      () => {},
    )

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const userContent = body.messages[0].content
    expect(userContent[0].type).toBe('text')
    expect(userContent[0].text).toContain('datum,type')
  })
})

// ── 3b. checkFileSize (client-side grootte-check) ─────────────────────────────

describe('checkFileSize', () => {
  const MB = 1024 * 1024
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

  it('accepts a normal PDF', () => {
    expect(checkFileSize('application/pdf', 5 * MB).level).toBe('ok')
  })

  it('blocks a PDF over the 20 MB limit', () => {
    const r = checkFileSize('application/pdf', 25 * MB)
    expect(r.level).toBe('block')
    expect(r.message).toContain('25 MB')
    expect(r.message).toContain('max 20 MB')
  })

  it('warns (but does not block) a spreadsheet over 10 MB', () => {
    const r = checkFileSize(XLSX, 12 * MB)
    expect(r.level).toBe('warn')
    expect(r.message).toContain('12 MB')
  })

  it('blocks a spreadsheet over the 20 MB limit', () => {
    expect(checkFileSize(XLSX, 25 * MB).level).toBe('block')
  })

  it('does not warn a small spreadsheet', () => {
    expect(checkFileSize(XLSX, 4 * MB).level).toBe('ok')
  })

  it('base64Bytes estimates original bytes from a base64 string', () => {
    expect(base64Bytes('a'.repeat(1000))).toBe(750)
  })
})

// ── 4. importToBackend error-pad ──────────────────────────────────────────────

describe('importToBackend (error)', () => {
  it('rethrows when createSchema fails', async () => {
    vi.mocked(createSchema).mockRejectedValueOnce(new Error('unauthorized'))

    const rows: ParsedRow[] = [{ datum: '2026-06-01', type: 'run', titel: 'Easy', detail: '', km: 8, fase: '' }]
    await expect(importToBackend(rows, async () => 'tok', () => {})).rejects.toThrow('unauthorized')
    expect(createActivitiesBatch).not.toHaveBeenCalled()
  })

  it('rolls back the schema when the batch insert fails', async () => {
    vi.mocked(createSchema).mockResolvedValueOnce({ id: 'schema-x' })
    vi.mocked(createActivitiesBatch).mockRejectedValueOnce(new Error('batch failed'))
    vi.mocked(deleteSchema).mockResolvedValueOnce(undefined)

    const rows: ParsedRow[] = [{ datum: '2026-06-01', type: 'run', titel: 'Easy', detail: '', km: 8, fase: '' }]
    await expect(importToBackend(rows, async () => 'tok', () => {})).rejects.toThrow('batch failed')
    expect(deleteSchema).toHaveBeenCalledWith('schema-x')
  })
})

// ── 5. importToBackend integration ───────────────────────────────────────────

const mkActivity = (over: Partial<Activity>): Activity => ({
  id: 'a', datum: '2026-06-01', type: 'run', titel: '', detail: '', km: null,
  feedback: null, fase: null, rating: null, updatedAt: '', createdAt: '',
  raceType: null, goalTime: null, isMainGoal: false, rowIndex: null, ...over,
})

describe('importToBackend (integration)', () => {
  it('creates a schema then batch-inserts all rows in one call', async () => {
    vi.mocked(createSchema).mockResolvedValueOnce({ id: 'schema-1' })
    vi.mocked(createActivitiesBatch).mockResolvedValueOnce([
      mkActivity({ id: 'act-1', datum: '2026-06-01', titel: 'Easy', km: 8 }),
      mkActivity({ id: 'act-2', datum: '2026-06-02', titel: 'Tempo', km: 10 }),
      mkActivity({ id: 'act-3', datum: '2026-06-03', type: 'rest', titel: 'Rust' }),
    ])

    const rows: ParsedRow[] = [
      { datum: '2026-06-01', type: 'run',  titel: 'Easy',  detail: '', km: 8,    fase: '' },
      { datum: '2026-06-02', type: 'run',  titel: 'Tempo', detail: '', km: 10,   fase: '' },
      { datum: '2026-06-03', type: 'rest', titel: 'Rust',  detail: '', km: null, fase: '' },
    ]

    const result = await importToBackend(rows, async () => 'tok', () => {})

    expect(result.schemaId).toBe('schema-1')
    expect(result.activities).toHaveLength(3)
    expect(result.activities[0].id).toBe('act-1')
    expect(createActivitiesBatch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(createActivitiesBatch).mock.calls[0][0]).toBe('schema-1')
    expect(vi.mocked(createActivitiesBatch).mock.calls[0][1]).toHaveLength(3)
    expect(vi.mocked(createActivitiesBatch).mock.calls[0][1][0]).toMatchObject({ datum: '2026-06-01', type: 'run', titel: 'Easy', km: 8 })
  })

  it('passes a schema name through to createSchema when given', async () => {
    vi.mocked(createSchema).mockResolvedValueOnce({ id: 'schema-2' })
    vi.mocked(createActivitiesBatch).mockResolvedValueOnce([])
    const rows: ParsedRow[] = [{ datum: '2026-06-01', type: 'run', titel: 'E', detail: '', km: 8, fase: '' }]
    await importToBackend(rows, async () => 'tok', () => {}, 'Marathonplan')
    expect(createSchema).toHaveBeenCalledWith('Marathonplan')
  })
})

// ── 6. parseRawResponse hardening ─────────────────────────────────────────────

describe('parseRawResponse', () => {
  it('ignores bracketed text in the report and finds the real rows array', () => {
    const raw = [
      'TITEL: Plan',
      'WEKEN: 2',
      'PIEK: 50 km',
      'DAGEN: vast',
      'RAPPORT: Een blokschema [build, piek, taper] met focus op tempo.',
      '[{"datum":"2026-06-01","type":"run","titel":"Easy","detail":"","km":8,"fase":""},',
      ' {"datum":"2026-06-02","type":"rust","titel":"Rust","detail":"","km":null,"fase":""}]',
    ].join('\n')

    const res = parseRawResponse(raw)
    expect(res.rows).toHaveLength(2)
    expect(res.rows[0].datum).toBe('2026-06-01')
    expect(res.rows[0].type).toBe('run')
    expect(res.rows[1].type).toBe('rest')
    expect(res.daysSignal).toBe('vast')
    expect(res.rapport).toContain('blokschema')
  })

  it('parses a fenced ```json code block', () => {
    const raw = 'TITEL: Plan\nWEKEN: 1\nPIEK: 10 km\nDAGEN: geen\nRAPPORT: Kort.\n```json\n[{"datum":"2026-07-01","type":"run","titel":"E","detail":"","km":5,"fase":""}]\n```'
    const res = parseRawResponse(raw)
    expect(res.rows).toHaveLength(1)
    expect(res.daysSignal).toBe('geen')
  })

  it('flags an unknown activity type with needsCheck and falls back to run (BUG11)', () => {
    const raw = 'TITEL: P\nWEKEN: 1\nPIEK: 10 km\nRAPPORT: x.\n[{"datum":"2026-08-01","type":"yoga-flow","titel":"Yoga","detail":"","km":null,"fase":""}]'
    const res = parseRawResponse(raw)
    expect(res.rows[0].type).toBe('run')
    expect(res.rows[0].needsCheck).toBe(true)
  })

  it('does not flag a known Dutch type', () => {
    const raw = 'TITEL: P\nWEKEN: 1\nPIEK: 10 km\nRAPPORT: x.\n[{"datum":"2026-08-01","type":"kracht","titel":"Kracht","detail":"","km":null,"fase":""}]'
    const res = parseRawResponse(raw)
    expect(res.rows[0].type).toBe('strength')
    expect(res.rows[0].needsCheck).toBeUndefined()
  })

  it('throws when no array is present', () => {
    expect(() => parseRawResponse('TITEL: P\nWEKEN: 1\nPIEK: 0\nRAPPORT: niets.')).toThrow('Geen schema gevonden.')
  })

  it('leaves daysSignal null when the signal is absent', () => {
    const raw = 'TITEL: P\nWEKEN: 1\nPIEK: 10 km\nRAPPORT: x.\n[{"datum":"2026-08-01","type":"run","titel":"E","detail":"","km":5,"fase":""}]'
    expect(parseRawResponse(raw).daysSignal).toBeNull()
  })
})
