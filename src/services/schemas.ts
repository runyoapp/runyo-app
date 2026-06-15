import { BACKEND, getAccessToken } from './auth'

export type Schema = {
  id: string
  userId: string
  name: string
  isVisible: boolean
  isArchived: boolean
  createdAt: string
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  if (!token) throw new Error('unauthorized: no access token available')
  return { Authorization: `Bearer ${token}` }
}

function ensureOk(status: number, context: string): void {
  if (status === 401) throw new Error('unauthorized')
  if (status >= 400) throw new Error(`${context} request failed: ${status}`)
}

export async function createSchema(name = 'Leeg schema'): Promise<{ id: string }> {
  const headers = await authHeaders()
  const res = await fetch(`${BACKEND}/api/schemas`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  ensureOk(res.status, 'create schema')
  return await res.json() as { id: string }
}

export async function getMySchemas(): Promise<Schema[]> {
  const headers = await authHeaders()
  const res = await fetch(`${BACKEND}/api/schemas/me`, {
    method: 'GET',
    headers,
  })
  ensureOk(res.status, 'get schemas')
  return await res.json() as Schema[]
}

export async function renameSchema(id: string, name: string): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch(`${BACKEND}/api/schemas/${id}/name`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  ensureOk(res.status, 'rename schema')
}

// Zet de zichtbaarheid van één schema (multi-schema: meerdere mogen zichtbaar zijn).
export async function setSchemaVisibility(id: string, visible: boolean): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch(`${BACKEND}/api/schemas/${id}/visibility`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ visible }),
  })
  ensureOk(res.status, 'set schema visibility')
}

// Archiveren: uit beeld halen zonder de historie te wissen (vervangt verwijderen).
export async function archiveSchema(id: string): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch(`${BACKEND}/api/schemas/${id}/archive`, {
    method: 'PATCH',
    headers,
  })
  ensureOk(res.status, 'archive schema')
}

// Hard verwijderen — alleen nog voor import-rollback (een net aangemaakt, leeg
// schema opruimen bij een mislukte import). Niet meer in de UI.
export async function deleteSchema(id: string): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch(`${BACKEND}/api/schemas/${id}`, {
    method: 'DELETE',
    headers,
  })
  ensureOk(res.status, 'delete schema')
}
