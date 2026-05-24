import { BACKEND, getAccessToken } from './auth'
import type { Activity, ActivityType } from '@/types/activity'

// runyo v4 — /api/schemas/:schemaId/activities frontend client (ticket 2.1d).

export type BackendActivity = {
  id: string
  schemaId: string
  datum: string
  type: string
  titel: string | null
  detail: string | null
  km: number | null
}

export type ActivityCreateInput = {
  datum: string
  type: ActivityType
  titel?: string | null
  detail?: string | null
  km?: number | null
}

export type ActivityPatchInput = {
  datum?: string
  type?: ActivityType
  titel?: string | null
  detail?: string | null
  km?: number | null
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  if (!token) throw new Error('unauthorized: no access token available')
  return { Authorization: `Bearer ${token}` }
}

function ensureOk(status: number, action: string): void {
  if (status === 401) throw new Error('unauthorized')
  if (status === 404) throw new Error('not_found')
  if (status >= 400) throw new Error(`${action} failed: ${status}`)
}

/**
 * Map a backend row to the frontend Activity shape. Backend doesn't track
 * feedback/fase/rating/raceType yet — those are reserved for later tickets.
 * `rowIndex` is Sheets-only and stays null on backend-sourced rows.
 */
const TYPE_NL: Record<string, ActivityType> = {
  rust: 'rest', loop: 'run', kracht: 'strength', mobiliteit: 'mobility',
  zwemmen: 'swim', fietsen: 'bike', gym: 'gym',
}

function normalizeType(raw: string): ActivityType {
  return TYPE_NL[raw.toLowerCase()] ?? (raw as ActivityType)
}

export function toActivity(row: BackendActivity): Activity {
  const now = new Date().toISOString()
  return {
    id: row.id,
    datum: row.datum,
    type: normalizeType(row.type),
    titel: row.titel ?? '',
    detail: row.detail ?? '',
    km: row.km,
    feedback: null,
    fase: null,
    rating: null,
    updatedAt: now,
    createdAt: now,
    raceType: null,
    rowIndex: null,
  }
}

export async function listActivities(schemaId: string): Promise<Activity[]> {
  const headers = await authHeaders()
  const res = await fetch(`${BACKEND}/api/schemas/${schemaId}/activities`, {
    method: 'GET',
    headers,
  })
  ensureOk(res.status, 'list activities')
  const rows = (await res.json()) as BackendActivity[]
  return rows.map(toActivity)
}

export async function createActivity(
  schemaId: string,
  input: ActivityCreateInput,
): Promise<Activity> {
  const headers = await authHeaders()
  const res = await fetch(`${BACKEND}/api/schemas/${schemaId}/activities`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  ensureOk(res.status, 'create activity')
  const row = (await res.json()) as BackendActivity
  return toActivity(row)
}

export async function patchActivity(
  schemaId: string,
  activityId: string,
  patch: ActivityPatchInput,
): Promise<Activity> {
  const headers = await authHeaders()
  const res = await fetch(`${BACKEND}/api/schemas/${schemaId}/activities/${activityId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  ensureOk(res.status, 'patch activity')
  const row = (await res.json()) as BackendActivity
  return toActivity(row)
}

export async function deleteActivity(
  schemaId: string,
  activityId: string,
): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch(`${BACKEND}/api/schemas/${schemaId}/activities/${activityId}`, {
    method: 'DELETE',
    headers,
  })
  ensureOk(res.status, 'delete activity')
}
