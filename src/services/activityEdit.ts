// Pure activity-mutation helpers used by DayDetailModal.
// No UI imports — this module is safe to unit-test in Node/vitest.
//
// All exported functions accept plain context objects so callers can
// pass store snapshots without coupling this module to React/Zustand.

import { patchActivity, deleteActivity as deleteBackendActivity } from './activities'
import type { Activity } from '@/types/activity'

export type DeleteContext = {
  schemaId: string
  getToken: () => Promise<string | null>
}

/**
 * Commit a delete to the backend. Called after the undo window expires.
 */
export async function commitDelete(activity: Activity, ctx: DeleteContext): Promise<void> {
  await deleteBackendActivity(ctx.schemaId, activity.id)
}

export type PatchContext = {
  schemaId: string
  getToken: () => Promise<string | null>
}

/**
 * Mark an activity as a rest day. Returns the updated activity shape.
 */
export async function markAsRest(activity: Activity, ctx: PatchContext): Promise<Activity> {
  const updated = await patchActivity(ctx.schemaId, activity.id, { type: 'rest', titel: null, km: null, detail: null })
  return { ...activity, ...updated }
}

/**
 * Validate that a delete can proceed given the available context.
 * Returns an error string, or null when the context is valid.
 */
export function validateDeleteContext(schemaId: string | null): string | null {
  if (!schemaId) return 'Geen schema gekoppeld'
  return null
}

/**
 * Validate that a patch/mark-as-rest can proceed.
 * Same rules as delete.
 */
export const validatePatchContext = validateDeleteContext

export type SaveInput = {
  datum: string
  titel: string
  type: import('@/types/activity').ActivityType
  km: number | null
  detail: string
  // Sessie-velden (alleen relevant voor trainingen) — meegestuurd zodat de
  // DayDetailModal dezelfde pace/HR/intervallen kan bewerken als de weekbouwer.
  targetPace?: string | null
  targetHr?: number | null
  intervals?: import('@/types/activity').IntervalBlock[] | null
}

/**
 * Persist an activity edit to the backend.
 * Returns the merged activity that should be stored locally.
 */
export async function saveActivity(
  activity: Activity,
  input: SaveInput,
  ctx: PatchContext,
): Promise<Activity> {
  const updated = await patchActivity(ctx.schemaId, activity.id, input)
  return { ...activity, ...updated }
}
