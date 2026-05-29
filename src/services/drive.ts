import type { SchemaEntry } from '@/types/auth'
import type { AppPrefs } from '@/types/settings'

const BASE = 'https://www.googleapis.com/drive/v3'
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'
const APP_DATA_FILE = 'runyo-settings.json'

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

type AppDataPayload = {
  prefs?: Partial<AppPrefs>
  schemaList?: SchemaEntry[]
  schemaDeleted?: string[]
}

async function getAppDataFileId(token: string): Promise<string | null> {
  const res = await fetch(
    `${BASE}/files?spaces=appDataFolder&q=name%3D'${APP_DATA_FILE}'&fields=files(id)`,
    { headers: authHeader(token) },
  )
  const data = await res.json() as { files?: { id: string }[] }
  return data.files?.[0]?.id ?? null
}

async function createAppDataFile(token: string, payload: AppDataPayload): Promise<string> {
  const metadata = JSON.stringify({ name: APP_DATA_FILE, parents: ['appDataFolder'] })
  const body = JSON.stringify(payload)

  const form = new FormData()
  form.append('metadata', new Blob([metadata], { type: 'application/json' }) as unknown as string)
  form.append('file', new Blob([body], { type: 'application/json' }) as unknown as string)

  const res = await fetch(`${UPLOAD_BASE}/files?uploadType=multipart`, {
    method: 'POST',
    headers: authHeader(token),
    body: form,
  })
  const data = await res.json() as { id: string }
  return data.id
}

export async function loadAppDataSettings(token: string): Promise<AppDataPayload> {
  const fileId = await getAppDataFileId(token)
  if (!fileId) return {}

  const res = await fetch(`${BASE}/files/${fileId}?alt=media`, {
    headers: authHeader(token),
  })
  if (!res.ok) return {}
  return await res.json() as AppDataPayload
}

export async function saveAppDataSettings(
  token: string,
  payload: AppDataPayload,
): Promise<void> {
  let fileId = await getAppDataFileId(token)
  const body = JSON.stringify(payload)

  if (!fileId) {
    await createAppDataFile(token, payload)
    return
  }

  const metadata = JSON.stringify({})
  const form = new FormData()
  form.append('metadata', new Blob([metadata], { type: 'application/json' }) as unknown as string)
  form.append('file', new Blob([body], { type: 'application/json' }) as unknown as string)

  await fetch(`${UPLOAD_BASE}/files/${fileId}?uploadType=multipart`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: form,
  })
}

// Lists recent Google Sheets files the user owns — replaces Google Picker
export async function listRecentSheets(token: string): Promise<SchemaEntry[]> {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false")
  const fields = encodeURIComponent('files(id,name,modifiedTime)')
  const res = await fetch(
    `${BASE}/files?q=${q}&fields=${fields}&orderBy=modifiedTime+desc&pageSize=20`,
    { headers: authHeader(token) },
  )
  const data = await res.json() as { files?: { id: string; name: string; modifiedTime: string }[] }
  return (data.files ?? []).map(f => ({
    id: f.id,
    name: f.name,
    url: null,
    ts: new Date(f.modifiedTime).getTime(),
  }))
}

export async function createNewSheet(token: string, name: string): Promise<SchemaEntry> {
  const uniqueName = await findUniqueName(token, name)
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: { title: uniqueName } }),
  })
  const data = await res.json() as { spreadsheetId: string; properties: { title: string } }
  return { id: data.spreadsheetId, name: data.properties.title, url: null, ts: Date.now() }
}

// Returns a sheet name that doesn't already exist in Drive (appends _2, _3 etc.)
async function findUniqueName(token: string, baseName: string): Promise<string> {
  const existing = await listRecentSheets(token)
  const names = new Set(existing.map(s => s.name))
  if (!names.has(baseName)) return baseName
  let i = 2
  while (names.has(`${baseName}_${i}`)) i++
  return `${baseName}_${i}`
}

export async function createExportSheet(token: string, schemaName: string): Promise<{ id: string; url: string }> {
  const title = `runyo — ${schemaName}`
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: 'Schema' } }],
    }),
  })
  if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  const data = await res.json() as { spreadsheetId: string }
  return { id: data.spreadsheetId, url: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}` }
}

export function todaySchemaName(): string {
  const d = new Date()
  const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  return `runyo schema ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
