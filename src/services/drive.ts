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
