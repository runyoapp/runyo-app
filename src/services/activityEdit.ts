// Pure activity-mutation helpers used by DayDetailModal.
// No UI imports — this module is safe to unit-test in Node/vitest.

import { deleteActivity as deleteSheetActivity, updateAndSort } from './sheets'
import { patchActivity, deleteActivity as deleteBackendActivity } from './activities'
import type { Activity } from '@/types/activity'

export type DeleteContext = {
  isSheetsRow: boolean
  sheetId: string
  sheetTabId: number
  tabName: string
  schemaId: string
  getToken: () => Promise<string | null>
}

/**
 * Commit a delete to the backing store (Sheets or backend).
 * Called after the undo window expires.
 */
export async function commitDelete(activity: Activity, ctx: DeleteContext): Promise<void> {
  if (ctx.isSheetsRow) {
    const token = await ctx.getToken()
    if (!token) throw new Error('unauthorized')
    // rowIndex is 1-based; Sheets delete API expects 0-based
    await deleteSheetActivity(ctx.sheetId, ctx.sheetTabId, token, activity.rowIndex! - 1)
  } else {
    await deleteBackendActivity(ctx.schemaId, activity.id)
  }
}

export type PatchContext = {
  isSheetsRow: boolean
  sheetId: string
  sheetTabId: number | null
  tabName: string
  schemaId: string
  getToken: () => Promise<string | null>
}

/**
 * Mark an activity as a rest day. Returns the updated activity shape.
 * Sheets path: updateAndSort with type 'rest' and cleared fields.
 * Backend path: PATCH with type 'rest'.
 */
export async function markAsRest(activity: Activity, ctx: PatchContext): Promise<Activity> {
  if (ctx.isSheetsRow) {
    const token = await ctx.getToken()
    if (!token) throw new Error('unauthorized')
    await updateAndSort(ctx.sheetId, ctx.tabName, ctx.sheetTabId, token, activity.rowIndex!, {
      type: 'rest',
      titel: '',
      km: null,
      detail: '',
    })
    return { ...activity, type: 'rest', titel: '', km: null, detail: '' }
  } else {
    const updated = await patchActivity(ctx.schemaId, activity.id, { type: 'rest', titel: null, km: null, detail: null })
    return { ...activity, ...updated }
  }
}

/**
 * Validate that a delete can proceed given the available context.
 * Returns an error string, or null when the context is valid.
 */
export function validateDeleteContext(
  isSheetsRow: boolean,
  sheetId: string | null,
  sheetTabId: number | null,
  schemaId: string | null,
): string | null {
  if (isSheetsRow && (!sheetId || sheetTabId == null)) return 'Geen schema gekoppeld'
  if (!isSheetsRow && !schemaId) return 'Geen schema gekoppeld'
  return null
}

/**
 * Validate that a patch/mark-as-rest can proceed.
 * Same rules as delete.
 */
export const validatePatchContext = validateDeleteContext
