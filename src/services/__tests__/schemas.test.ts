import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the auth module — getAccessToken returns a stub token for these tests.
vi.mock('../auth', () => ({
  BACKEND: 'https://runyo-auth-production.up.railway.app',
  getAccessToken: vi.fn(async () => 'test-token'),
}))

import { createSchema, getMySchemas } from '../schemas'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  fetchMock.mockReset()
})

describe('createSchema', () => {
  it('returns the parsed body on 201 and sends a bearer header', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'abc' }),
    })

    const result = await createSchema()

    expect(result).toEqual({ id: 'abc' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://runyo-auth-production.up.railway.app/api/schemas')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer test-token')
  })

  it('throws unauthorized on 401', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    })

    await expect(createSchema()).rejects.toThrow(/unauthorized/)
  })
})

describe('getMySchemas', () => {
  it('returns the parsed array on 200', async () => {
    const payload = [
      { id: 'abc', userId: 'u1', createdAt: '2026-05-17T00:00:00.000Z' },
    ]
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => payload,
    })

    const result = await getMySchemas()

    expect(result).toEqual(payload)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://runyo-auth-production.up.railway.app/api/schemas/me')
    expect(init.method ?? 'GET').toBe('GET')
    expect(init.headers.Authorization).toBe('Bearer test-token')
  })

  it('throws unauthorized on 401', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    })

    await expect(getMySchemas()).rejects.toThrow(/unauthorized/)
  })
})
