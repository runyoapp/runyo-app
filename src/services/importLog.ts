import { getAccessToken } from './auth'

export const BACKEND = 'https://runyo-auth-production.up.railway.app'

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
  durationMs:   number | null
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
  const res = await fetch(`${BACKEND}/import/log`, { headers: await adminAuthHeader() })
  if (res.status === 401) throw new Error('Alleen voor beheerders')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<ImportLogEntry[]>
}

// Downloadt het bewaarde importbestand. Op web fetchen we met token → blob →
// trigger een download (een open URL kan geen auth-header meesturen).
export async function downloadImportFile(id: string, fileName: string | null): Promise<void> {
  const res = await fetch(`${BACKEND}/import/log/${id}/file`, { headers: await adminAuthHeader() })
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
