// runyo schema import service — pure orchestration, no UI imports.
// All I/O with the filesystem, image picker, and backend lives here.
// The ImportModal / ImportFlow screen is the only caller.

import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { appendActivity, verifyOrFixHeaders, getSheetTabId, sortSheet } from './sheets'
import { createNewSheet } from './drive'
import type { ActivityType } from '@/constants/activities'

export const IMPORT_BACKEND = 'https://runyo-auth-production.up.railway.app'

export const SYSTEM_PROMPT = `Je krijgt een trainingsschema (PDF, afbeelding, Excel of tekst).

Eerste stap: Scan naar weken en dagroosters. Sla inleidingen en algemene adviezen over.

Velden per item: datum (YYYY-MM-DD), type (run|kracht|mobiliteit|rust|herstel|werk|race), titel (max 70 tekens), detail (max 170 tekens), km (number|null), fase ("" altijd leeg).

Regels:
1. Volg exact de weken en dagen. Ontbrekende dagen → rust.
2. Begindatum = eerste dag week 1. Elke week +7 dagen.
3. REST/Off → type rust. Cross-Training → mobiliteit.
4. Meerdere sessies per dag: combineer in één item.
5. km: miles × 1.609, afronden op 1 decimaal. Geen afstand → null.
6. Output: chronologisch, één entry per dag.

Schrijf eerst TITEL: (max 30 tekens).
Dan WEKEN: (getal, bijv. "12").
Dan PIEK: (hoogste weekvolume in km, bijv. "65 km").
Dan RAPPORT: (max 3 zinnen plain language).
Dan direct de JSON array, geen markdown.`

export type ParsedRow = {
  datum: string
  type: string
  titel: string
  detail: string
  km: number | null
  fase: string
}

export type PickResult = {
  fileName: string
  fileMime: string
  fileB64: string
}

export type AnalyseResult = {
  schemaTitle: string
  wekenStr: string
  piekStr: string
  rapport: string
  rows: ParsedRow[]
}

export async function pickFile(): Promise<PickResult | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
  if (result.canceled || !result.assets?.[0]) return null
  const asset = result.assets[0]
  const fileB64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
  return {
    fileName: asset.name,
    fileMime: asset.mimeType ?? 'application/pdf',
    fileB64,
  }
}

export async function pickPhoto(fromCamera = false): Promise<PickResult | null> {
  if (fromCamera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) return null
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 })
    if (result.canceled || !result.assets?.[0]) return null
    return { fileName: 'foto.jpg', fileMime: 'image/jpeg', fileB64: result.assets[0].base64 ?? '' }
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) return null
  const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 })
  if (result.canceled || !result.assets?.[0]) return null
  return { fileName: 'foto.jpg', fileMime: 'image/jpeg', fileB64: result.assets[0].base64 ?? '' }
}

/**
 * Parse the raw text response from the backend into structured AnalyseResult.
 * Pure function — safe to unit-test without mocking fetch.
 */
export function parseRawResponse(raw: string): AnalyseResult {
  const titelM   = raw.match(/TITEL\s*:\s*([^\n\r]{1,40})/i)
  const wekenM   = raw.match(/WEKEN\s*:\s*(\d+)/i)
  const piekM    = raw.match(/PIEK\s*:\s*([^\n\r]{1,20})/i)
  const rapportM = raw.match(/RAPPORT\s*:\s*([\s\S]*?)(?=\[|$)/i)

  const schemaTitle = titelM?.[1]?.trim() ?? ''
  const wekenStr    = wekenM?.[1] ? `${wekenM[1]} weken` : ''
  const piekStr     = piekM?.[1]?.trim() ?? ''
  const rapport     = rapportM?.[1]?.trim() ?? ''

  let parsed: ParsedRow[] | null = null
  const m = raw.match(/\[[\s\S]*\]/)
  if (m) { try { parsed = JSON.parse(m[0]) } catch {} }
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('Geen schema gevonden.')

  const rows = parsed
    .filter(r => r?.datum && /^\d{4}-\d{2}-\d{2}$/.test(r.datum))
    .map(r => ({
      datum: r.datum,
      type: r.type || 'run',
      titel: String(r.titel || ''),
      detail: String(r.detail || ''),
      km: r.km != null ? Number(r.km) || null : null,
      fase: r.fase || '',
    }))

  return { schemaTitle, wekenStr, piekStr, rapport, rows }
}

export async function analyseSchema(
  fileB64: string,
  fileMime: string,
  startDate: string,
  runDays: number[],
  keepRest: boolean,
  getToken: () => Promise<string | null>,
  onProgress: (pct: number) => void,
): Promise<AnalyseResult> {
  const DAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
  const dayNames = DAY_LABELS.filter((_, i) => runDays.includes(i)).join(', ')
  const userText = `Begindatum: ${startDate}. Hardloopdagen: ${dayNames}. Rustdagen behouden: ${keepRest ? 'ja' : 'nee'}.`

  const isImage = fileMime === 'image/jpeg' || fileMime === 'image/png'
  const userContent = isImage
    ? [
        { type: 'image', source: { type: 'base64', media_type: fileMime, data: fileB64 } },
        { type: 'text', text: userText },
      ]
    : [
        { type: 'document', source: { type: 'base64', media_type: fileMime, data: fileB64 } },
        { type: 'text', text: userText },
      ]

  let pct = 0
  const progressTimer = setInterval(() => { pct = Math.min(pct + 3, 85); onProgress(pct) }, 200)

  try {
    const token = await getToken()
    const res = await fetch(`${IMPORT_BACKEND}/ai/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ system: SYSTEM_PROMPT, messages: [{ role: 'user', content: userContent }] }),
    })
    if (!res.ok) throw new Error(`Fout ${res.status}`)
    const json = await res.json() as { content: { text: string }[] }
    const raw = json.content?.[0]?.text ?? ''

    onProgress(95)
    return parseRawResponse(raw)
  } finally {
    clearInterval(progressTimer)
  }
}

export async function confirmImport(
  rows: ParsedRow[],
  schemaTitle: string,
  getToken: () => Promise<string | null>,
  setSchema: (sheetId: string, tabName: string, fileName: string, tabId: number) => Promise<void>,
  onProgress: (pct: number) => void,
): Promise<void> {
  const token = await getToken()
  if (!token) throw new Error('Niet ingelogd')

  const d = new Date()
  const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  const titlePart = schemaTitle ? `${schemaTitle} ` : ''
  const baseName = `runyo schema ${titlePart}${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`

  const entry = await createNewSheet(token, baseName)
  await verifyOrFixHeaders(entry.id, 'Schema', token)

  let pct = 0
  const timer = setInterval(() => { pct = Math.min(pct + 2, 90); onProgress(pct) }, 300)
  try {
    for (const row of rows) {
      await appendActivity(entry.id, 'Schema', token, {
        datum: row.datum,
        type: row.type as ActivityType,
        titel: row.titel,
        detail: row.detail,
        km: row.km,
        feedback: null,
        fase: row.fase,
        raceType: null,
      })
    }
  } finally {
    clearInterval(timer)
  }

  const tabId = await getSheetTabId(entry.id, 'Schema', token).catch(() => 0)
  if (tabId) await sortSheet(entry.id, tabId, token).catch(() => {})
  await setSchema(entry.id, 'Schema', entry.name, tabId)
  onProgress(100)
}
