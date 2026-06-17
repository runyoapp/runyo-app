import { BACKEND, getAccessToken } from './auth'
import type { Activity, ActivityType, IntervalBlock } from '@/types/activity'

// runyo v4 — /api/schemas/:schemaId/activities frontend client (ticket 2.1d).

export type BackendActivity = {
  id: string
  schemaId: string
  datum: string
  type: string
  titel: string | null
  detail: string | null
  km: number | null
  raceType: string | null
  goalTime: string | null
  isMainGoal: boolean
  feedback: string | null
  rating: number | null
  targetPace: string | null
  targetHr: number | null
  intervals: IntervalBlock[] | null
}

export type ActivityCreateInput = {
  datum: string
  type: ActivityType
  titel?: string | null
  detail?: string | null
  km?: number | null
  raceType?: string | null
  goalTime?: string | null
  isMainGoal?: boolean
  feedback?: string | null
  rating?: number | null
  targetPace?: string | null
  targetHr?: number | null
  intervals?: IntervalBlock[] | null
}

export type ActivityPatchInput = {
  datum?: string
  type?: ActivityType
  titel?: string | null
  detail?: string | null
  km?: number | null
  raceType?: string | null
  goalTime?: string | null
  isMainGoal?: boolean
  feedback?: string | null
  rating?: number | null
  targetPace?: string | null
  targetHr?: number | null
  intervals?: IntervalBlock[] | null
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
 * Map a backend row to the frontend Activity shape. Backend tracks
 * feedback + rating; `fase` is not persisted yet.
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
    schemaId: row.schemaId,
    datum: row.datum,
    type: normalizeType(row.type),
    titel: row.titel ?? '',
    detail: row.detail ?? '',
    km: row.km,
    feedback: row.feedback,
    fase: null,
    rating: row.rating,
    updatedAt: now,
    createdAt: now,
    raceType: row.raceType,
    goalTime: row.goalTime,
    isMainGoal: row.isMainGoal,
    rowIndex: null,
    targetPace: row.targetPace ?? null,
    targetHr: row.targetHr ?? null,
    intervals: row.intervals ?? null,
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

/**
 * Insert many activities onto a schema in one transactional request.
 * Used by the import wizard so a full schema lands all-or-nothing. The backend
 * validates every row before inserting; a single bad row → 400, nothing saved.
 */
export async function createActivitiesBatch(
  schemaId: string,
  inputs: ActivityCreateInput[],
): Promise<Activity[]> {
  const headers = await authHeaders()
  const res = await fetch(`${BACKEND}/api/schemas/${schemaId}/activities/batch`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ activities: inputs }),
  })
  ensureOk(res.status, 'batch create activities')
  const rows = (await res.json()) as BackendActivity[]
  return rows.map(toActivity)
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
