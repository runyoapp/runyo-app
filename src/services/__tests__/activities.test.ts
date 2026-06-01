import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../auth', () => ({
  BACKEND: 'https://runyo-auth-production.up.railway.app',
  getAccessToken: vi.fn(async () => 'test-token'),
}))

import {
  listActivities,
  createActivity,
  patchActivity,
  deleteActivity,
  toActivity,
  type BackendActivity,
} from '../activities'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  fetchMock.mockReset()
})

const SCHEMA = 'schema-abc'

function backendRow(over: Partial<BackendActivity> = {}): BackendActivity {
  return {
    id: 'act-1',
    schemaId: SCHEMA,
    datum: '2026-06-01',
    type: 'run',
    titel: 'Easy run',
    detail: null,
    km: 8.2,
    raceType: null,
    goalTime: null,
    isMainGoal: false,
    feedback: null,
    rating: null,
    ...over,
  }
}

describe('toActivity', () => {
  it('maps a backend row to the frontend Activity shape with null defaults', () => {
    const activity = toActivity(backendRow({ titel: null, detail: null, km: null }))
    expect(activity.id).toBe('act-1')
    expect(activity.titel).toBe('')
    expect(activity.detail).toBe('')
    expect(activity.km).toBeNull()
    expect(activity.feedback).toBeNull()
    expect(activity.fase).toBeNull()
    expect(activity.rating).toBeNull()
    expect(activity.raceType).toBeNull()
    expect(activity.rowIndex).toBeNull()
    expect(typeof activity.updatedAt).toBe('string')
    expect(typeof activity.createdAt).toBe('string')
  })

  it('maps feedback + rating through from the backend row', () => {
    const activity = toActivity(backendRow({ feedback: '4/5 💪 – goed', rating: 4 }))
    expect(activity.feedback).toBe('4/5 💪 – goed')
    expect(activity.rating).toBe(4)
  })
})

describe('listActivities', () => {
  it('returns mapped rows on 200', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [backendRow(), backendRow({ id: 'act-2', titel: null })],
    })

    const result = await listActivities(SCHEMA)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('act-1')
    expect(result[1].titel).toBe('')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`https://runyo-auth-production.up.railway.app/api/schemas/${SCHEMA}/activities`)
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBe('Bearer test-token')
  })

  it('throws not_found on 404 (foreign schema)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
    await expect(listActivities(SCHEMA)).rejects.toThrow(/not_found/)
  })
})

describe('createActivity', () => {
  it('POSTs the input and returns the mapped activity on 201', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => backendRow({ id: 'new-1', titel: 'Tempo', km: 10.0 }),
    })

    const result = await createActivity(SCHEMA, {
      datum: '2026-06-02',
      type: 'strength',
      titel: 'Tempo',
      km: 10.0,
    })

    expect(result.id).toBe('new-1')
    expect(result.titel).toBe('Tempo')
    expect(result.km).toBe(10.0)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`https://runyo-auth-production.up.railway.app/api/schemas/${SCHEMA}/activities`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).titel).toBe('Tempo')
  })

  it('throws on 400 (validation error)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: 'invalid_datum' }) })
    await expect(
      createActivity(SCHEMA, { datum: 'nope', type: 'run' }),
    ).rejects.toThrow(/create activity failed: 400/)
  })
})

describe('patchActivity', () => {
  it('PATCHes a partial body and returns the updated activity on 200', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => backendRow({ titel: 'new title' }),
    })

    const result = await patchActivity(SCHEMA, 'act-1', { titel: 'new title' })

    expect(result.titel).toBe('new title')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      `https://runyo-auth-production.up.railway.app/api/schemas/${SCHEMA}/activities/act-1`,
    )
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ titel: 'new title' })
  })

  it('throws not_found on 404 (foreign activity)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
    await expect(patchActivity(SCHEMA, 'act-99', { titel: 'x' })).rejects.toThrow(/not_found/)
  })
})

describe('deleteActivity', () => {
  it('returns void on 204', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) })
    await expect(deleteActivity(SCHEMA, 'act-1')).resolves.toBeUndefined()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      `https://runyo-auth-production.up.railway.app/api/schemas/${SCHEMA}/activities/act-1`,
    )
    expect(init.method).toBe('DELETE')
  })

  it('throws not_found on 404 (already deleted or foreign)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
    await expect(deleteActivity(SCHEMA, 'gone')).rejects.toThrow(/not_found/)
  })
})
