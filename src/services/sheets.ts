import type { Activity, RawSheetRow } from '@/types/activity'
import type { ActivityType } from '@/constants/activities'
import { TYPE_NL_MAP } from '@/constants/activities'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

const REQUIRED_HEADERS = ['datum', 'type', 'titel', 'detail', 'km', 'feedback', 'fase']

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export async function fetchActivities(
  sheetId: string,
  tabName: string,
  token: string,
): Promise<Activity[]> {
  const range = `${encodeURIComponent(tabName)}!A:K`
  const res = await fetch(`${BASE}/${sheetId}/values/${range}`, {
    headers: authHeader(token),
  })
  if (!res.ok) throw new Error(`Sheets read failed: ${res.status}`)
  const data = await res.json() as { values?: string[][] }
  const rows = data.values ?? []
  if (rows.length < 2) return []

  const headers = rows[0].map(h => h.toLowerCase().trim())
  return rows.slice(1)
    .map((row, i) => {
      const activity = mapRow(row, headers)
      if (activity) activity.rowIndex = i + 2  // header=1, first data=2
      return activity
    })
    .filter(Boolean) as Activity[]
}

export async function appendAndSort(
  sheetId: string,
  tabName: string,
  token: string,
  activity: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'rating' | 'rowIndex'>,
): Promise<void> {
  await appendActivity(sheetId, tabName, token, activity)
  const tabId = await getSheetTabId(sheetId, tabName, token).catch(() => 0)
  if (tabId) await sortSheet(sheetId, tabId, token).catch(() => {})
}

// Same as appendAndSort but for in-place edits. We sort even when the
// edit doesn't touch column A, because the caller doesn't always know
// whether the field set includes `datum`, and an extra sort is a no-op
// when the sheet was already in order.
export async function updateAndSort(
  sheetId: string,
  tabName: string,
  sheetTabId: number | null,
  token: string,
  rowIndex: number,
  activity: Partial<Activity>,
): Promise<void> {
  await updateActivity(sheetId, tabName, token, rowIndex, activity)
  const tabId = sheetTabId ?? await getSheetTabId(sheetId, tabName, token).catch(() => 0)
  if (tabId) await sortSheet(sheetId, tabId, token).catch(() => {})
}

export async function appendActivity(
  sheetId: string,
  tabName: string,
  token: string,
  activity: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'rating' | 'rowIndex'>,
): Promise<void> {
  const now = new Date().toISOString()
  const id = `rx_${Date.now()}`
  const row = [
    activity.datum,
    activity.type,
    activity.titel,
    activity.detail,
    activity.km != null ? String(activity.km) : '',
    activity.feedback ?? '',
    activity.fase ?? '',
    id,
    now,
    now,
    activity.raceType ?? '',
  ]
  const range = `${encodeURIComponent(tabName)}!A:K`
  // USER_ENTERED so Sheets parses our YYYY-MM-DD as a real date cell and
  // honours the user's existing column-A date format. RAW would store it
  // as text, breaking sort and mixing badly with existing date cells.
  await fetch(`${BASE}/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] }),
  })
}

export async function updateActivity(
  sheetId: string,
  tabName: string,
  token: string,
  rowIndex: number,   // 1-based, header is row 1, first data row is 2
  activity: Partial<Activity>,
): Promise<void> {
  // Read current row first to preserve fields we're not updating
  const range = `${encodeURIComponent(tabName)}!A${rowIndex}:K${rowIndex}`
  const readRes = await fetch(`${BASE}/${sheetId}/values/${range}`, {
    headers: authHeader(token),
  })
  const readData = await readRes.json() as { values?: string[][] }
  const current = readData.values?.[0] ?? Array(11).fill('')

  const now = new Date().toISOString()
  const merged = [
    activity.datum    ?? current[0],
    activity.type     ?? current[1],
    activity.titel    ?? current[2],
    activity.detail   ?? current[3],
    activity.km != null ? String(activity.km) : current[4],
    activity.feedback ?? current[5],
    activity.fase     ?? current[6],
    current[7],          // id — never change
    now,                 // updated_at
    current[9],          // created_at — never change
    activity.raceType ?? current[10],
  ]

  await fetch(`${BASE}/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [merged] }),
  })
}

export async function deleteActivity(
  sheetId: string,
  sheetTabId: number,  // numeric tab/sheet ID (not the spreadsheet ID)
  token: string,
  rowIndex: number,    // 0-based for batchUpdate
): Promise<void> {
  await fetch(`${BASE}/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheetTabId,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1,
          },
        },
      }],
    }),
  })
}

export async function sortSheet(
  sheetId: string,
  sheetTabId: number,
  token: string,
): Promise<void> {
  await fetch(`${BASE}/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        sortRange: {
          range: { sheetId: sheetTabId, startRowIndex: 1, startColumnIndex: 0 },
          sortSpecs: [{ dimensionIndex: 0, sortOrder: 'ASCENDING' }],
        },
      }],
    }),
  })
}

export async function getSheetTabId(
  sheetId: string,
  tabName: string,
  token: string,
): Promise<number> {
  const res = await fetch(`${BASE}/${sheetId}?fields=sheets.properties`, {
    headers: authHeader(token),
  })
  const data = await res.json() as { sheets: { properties: { sheetId: number; title: string } }[] }
  const sheet = data.sheets.find(s => s.properties.title === tabName)
  if (!sheet) throw new Error(`Tab "${tabName}" not found`)
  return sheet.properties.sheetId
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

function normalizeType(raw: string): ActivityType {
  const lower = raw.toLowerCase().trim()
  return TYPE_NL_MAP[lower] ?? (lower as ActivityType) ?? 'run'
}

function mapRow(row: RawSheetRow, headers: string[]): Activity | null {
  const get = (key: string) => row[headers.indexOf(key)] ?? ''
  const datum = get('datum')
  if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return null

  return {
    id:        get('id') || `rx_${datum}_${Math.random().toString(36).slice(2)}`,
    datum,
    type:      normalizeType(get('type') || 'run'),
    titel:     get('titel'),
    detail:    get('detail'),
    km:        parseFloat(get('km')) || null,
    feedback:  get('feedback') || null,
    fase:      get('fase') || null,
    rating:    null,
    updatedAt: get('updated_at') || new Date().toISOString(),
    createdAt: get('created_at') || new Date().toISOString(),
    raceType:  get('race_type') || null,
    rowIndex:  null,  // set by caller after mapping with index
  }
}
