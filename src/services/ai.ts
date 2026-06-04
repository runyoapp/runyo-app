import { getAccessToken } from './auth'

export const BACKEND = 'https://runyo-auth-production.up.railway.app'

export type ImportResult = {
  rows: {
    datum: string
    type: string
    titel: string
    detail: string
    km: number | null
    fase: string | null
  }[]
}

export async function runAiImport(prompt: string): Promise<ImportResult> {
  const res = await fetch(`${BACKEND}/ai/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`AI import failed: ${res.status}`)
  const data = await res.json() as { content: { text: string }[] }
  const text = data.content[0]?.text ?? '[]'

  const jsonMatch = text.match(/```json\n?([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/)
  const parsed = JSON.parse(jsonMatch?.[1] ?? text) as ImportResult['rows']
  return { rows: parsed }
}

export type ImportLogEntry = {
  id:           string
  ts:           string
  ip:           string | null
  email:        string | null
  fileName:     string | null
  fileMime:     string | null
  fileSize:     number | null
  ok:           boolean
  error:        string | null
  inputTokens:  number | null
  outputTokens: number | null
  rowCount:     number | null
  schemaTitle:  string | null
  rawPreview:   string | null
  hasFile:      boolean
}

// De import-log endpoints zijn alleen voor beheerders (ADMIN_EMAILS op de
// backend). We sturen het Google-token mee; 401 → geen beheerder.
async function adminAuthHeader(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  if (!token) throw new Error('Niet ingelogd')
  return { Authorization: `Bearer ${token}` }
}

export async function getImportLog(): Promise<ImportLogEntry[]> {
  const res = await fetch(`${BACKEND}/ai/import-log`, { headers: await adminAuthHeader() })
  if (res.status === 401) throw new Error('Alleen voor beheerders')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<ImportLogEntry[]>
}

// Downloadt het bewaarde importbestand. Op web fetchen we met token → blob →
// trigger een download (een open URL kan geen auth-header meesturen).
export async function downloadImportFile(id: string, fileName: string | null): Promise<void> {
  const res = await fetch(`${BACKEND}/ai/import-log/${id}/file`, { headers: await adminAuthHeader() })
  if (res.status === 401) throw new Error('Alleen voor beheerders')
  if (res.status === 404) throw new Error('Bestand niet meer beschikbaar (verlopen na 30 dagen)')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = fileName || 'import'
  a.click()
  URL.revokeObjectURL(url)
}

export async function logDebug(entry: Record<string, unknown>): Promise<void> {
  await fetch(`${BACKEND}/ai/debug-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...entry, ts: new Date().toISOString() }),
  }).catch(() => {})  // fire-and-forget, never throws
}
