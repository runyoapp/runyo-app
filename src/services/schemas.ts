import { BACKEND, getAccessToken } from './auth'

export type Schema = {
  id: string
  userId: string
  createdAt: string
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  if (!token) throw new Error('unauthorized: no access token available')
  return { Authorization: `Bearer ${token}` }
}

function ensureOk(status: number): void {
  if (status === 401) throw new Error('unauthorized')
  if (status >= 400) throw new Error(`schemas request failed: ${status}`)
}

export async function createSchema(): Promise<{ id: string }> {
  const headers = await authHeaders()
  const res = await fetch(`${BACKEND}/api/schemas`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  ensureOk(res.status)
  return await res.json() as { id: string }
}

export async function getMySchemas(): Promise<Schema[]> {
  const headers = await authHeaders()
  const res = await fetch(`${BACKEND}/api/schemas/me`, {
    method: 'GET',
    headers,
  })
  ensureOk(res.status)
  return await res.json() as Schema[]
}
