import type { Activity } from '@/types/activity'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

const REQUIRED_HEADERS = ['datum', 'type', 'titel', 'detail', 'km', 'feedback', 'fase']

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export function activitiesToSheetRows(activities: Activity[]): string[][] {
  return [...activities]
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .map(a => [
      a.datum,
      a.type,
      a.titel ?? '',
      a.detail ?? '',
      a.km != null ? String(a.km) : '',
      a.feedback ?? '',
      a.fase ?? '',
      a.id,
      a.updatedAt,
      a.createdAt,
      a.raceType ?? '',
    ])
}

export async function syncActivitiesToSheet(
  sheetId: string,
  tabName: string,
  token: string,
  activities: Activity[],
): Promise<{ synced: number }> {
  await verifyOrFixHeaders(sheetId, tabName, token)

  const clearRange = `${encodeURIComponent(tabName)}!A2:K`
  await fetch(`${BASE}/${sheetId}/values/${clearRange}:clear`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
  })

  if (activities.length === 0) return { synced: 0 }

  const rows = activitiesToSheetRows(activities)
  const writeRange = `${encodeURIComponent(tabName)}!A2:K${rows.length + 1}`
  await fetch(`${BASE}/${sheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: rows }),
  })

  return { synced: rows.length }
}

export async function verifyOrFixHeaders(
  sheetId: string,
  tabName: string,
  token: string,
): Promise<void> {
  const range = `${encodeURIComponent(tabName)}!A1:K1`
  const res = await fetch(`${BASE}/${sheetId}/values/${range}`, {
    headers: authHeader(token),
  })
  const data = await res.json() as { values?: string[][] }
  const existing = (data.values?.[0] ?? []).map(h => h.toLowerCase().trim())

  const missing = REQUIRED_HEADERS.filter(h => !existing.includes(h))
  if (missing.length === 0) return

  // Append missing headers at end of header row
  const allHeaders = [...existing, ...missing]
  await fetch(`${BASE}/${sheetId}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [allHeaders] }),
  })
}

