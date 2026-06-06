// runyo schema import service — pure orchestration, no UI imports.
// All I/O with the filesystem, image picker, and backend lives here.
// The ImportModal / ImportFlow screen is the only caller.

import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'
import * as xlsx from 'xlsx'
import { createSchema } from './schemas'
import { createActivity } from './activities'
import { TYPE_NL_MAP, ACTIVITY_TYPES } from '@/constants/activities'
import type { Activity, ActivityType } from '@/types/activity'

export const IMPORT_BACKEND = 'https://runyo-auth-production.up.railway.app'

export const SYSTEM_PROMPT = `Je bent een schema-formatter. Zet een trainingsschema PRECIES over naar het app-formaat.

JE TAAK: Letterlijk kopiëren en formatteren — NIET interpreteren, herschrijven of aanpassen.

WAT JE NOOIT MAG VERANDEREN:
- Snelheden, tempo's (min/km of km/h), hartslagen (bpm), zones
- Afstanden (converteer alleen miles → km, pas de waarden zelf niet aan)
- Rustdagen, hersteldagen en lege dagen — houd ze precies aan
- Volgorde van trainingsdagen en structuur van elke training

WAT JE WEL MAG:
- Vertalen van Engels naar Nederlands (maar behoud alle waarden letterlijk)
- Miles → km omrekenen (× 1.609, afgerond op 1 decimaal)
- Meerdere sessies op één dag samenvoegen in één item

Velden per item: datum (YYYY-MM-DD), type (run|kracht|mobiliteit|rust|herstel|werk|race), titel (max 70 tekens), detail (max 500 tekens — kopieer zo letterlijk mogelijk), km (number|null), fase ("" altijd leeg).

Regels:
1. Begindatum opgegeven door gebruiker = dag 1 van week 1. Elke week +7 dagen.
2. Ontbrekende of lege dagen → type rust.
3. REST / Off / Vrij → type rust. Cross-Training → mobiliteit.
4. Output: chronologisch, één entry per dag, alle weken volledig.

Schrijf eerst TITEL: (max 30 tekens — naam van het schema).
Dan WEKEN: (getal, bijv. "12").
Dan PIEK: (hoogste weekvolume in km, bijv. "65 km").
Dan RAPPORT: (max 2 zinnen, beschrijf het schema neutraal).
Dan direct de JSON array, geen markdown.`

const XLSX_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]

const MB = 1024 * 1024
// Harde grens vóór upload: ruim onder de request-limiet, zodat we niet blokkeren
// wat eigenlijk nog zou lukken maar wel de "Failed to fetch"-randgevallen voorkomen.
export const MAX_FILE_BYTES = 20 * MB
// Spreadsheets worden server-side naar CSV omgezet; vanaf deze grootte waarschuwen
// we dat die omzetting kan mislukken, zonder te blokkeren.
export const EXCEL_WARN_BYTES = 10 * MB
// Grote foto's downscalen naar deze langste zijde — ruim voldoende om een
// schema-briefje te lezen en houdt de upload klein.
const MAX_PHOTO_EDGE = 2000

// base64-string → geschatte originele bytes (3 bytes per 4 tekens).
export function base64Bytes(b64: string): number {
  return Math.round(b64.length * 0.75)
}

function fmtMB(bytes: number): string {
  const mb = bytes / MB
  return mb < 10 ? mb.toFixed(1) : mb.toFixed(0)
}

export type SizeCheck = { level: 'ok' | 'warn' | 'block'; message: string }

// Client-side grootte-check vóór upload. PDF/foto: harde grens 20 MB.
// Spreadsheets: zelfde harde grens, plus een zachte waarschuwing vanaf 10 MB
// omdat de CSV-omzetting bij grote bestanden kan mislukken.
export function checkFileSize(fileMime: string, bytes: number): SizeCheck {
  if (bytes > MAX_FILE_BYTES) {
    return {
      level: 'block',
      message: `Dit bestand is te groot (${fmtMB(bytes)} MB) — max 20 MB. Tip: knip het schema in delen (bijv. alleen de komende weken), of exporteer het als Google Sheet en plak de link.`,
    }
  }
  if (XLSX_MIMES.includes(fileMime) && bytes > EXCEL_WARN_BYTES) {
    return {
      level: 'warn',
      message: `Dit is een groot bestand (${fmtMB(bytes)} MB). Het omzetten kan mislukken — lukt het niet, exporteer dan een kleiner tabblad of plak de link.`,
    }
  }
  return { level: 'ok', message: '' }
}

// Het systeem-prompt stuurt Nederlandse type-namen (rust, kracht, mobiliteit, …).
// Normaliseer naar de canonical ActivityType-enum zodat filters betrouwbaar werken.
function normalizeType(raw: string): ActivityType {
  const lower = raw.toLowerCase().trim()
  if ((ACTIVITY_TYPES as readonly string[]).includes(lower)) return lower as ActivityType
  return TYPE_NL_MAP[lower] ?? 'run'
}

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

export function excelToText(base64: string): string {
  const wb = xlsx.read(base64, { type: 'base64' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return xlsx.utils.sheet_to_csv(sheet)
}

export async function pickFile(): Promise<PickResult | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
  if (result.canceled || !result.assets?.[0]) return null
  const asset = result.assets[0]
  let fileB64: string
  if (typeof document !== 'undefined') {
    const resp = await fetch(asset.uri)
    const blob = await resp.blob()
    const mimeType = blob.type || asset.mimeType || 'application/pdf'
    fileB64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return { fileName: asset.name, fileMime: mimeType, fileB64 }
  }
  fileB64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
  return {
    fileName: asset.name,
    fileMime: asset.mimeType || 'application/pdf',
    fileB64,
  }
}

// Grote foto's (bv. 48MP) downscalen zodat ze niet de upload-limiet raken.
// expo-image-picker comprimeert alleen de JPEG-kwaliteit, niet de afmetingen,
// dus een foto kan ondanks quality 0.8 nog tientallen MB zijn.
async function photoToB64(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const longest = Math.max(asset.width ?? 0, asset.height ?? 0)
  if (longest <= MAX_PHOTO_EDGE) return asset.base64 ?? ''
  const resize = (asset.width ?? 0) >= (asset.height ?? 0)
    ? { width: MAX_PHOTO_EDGE }
    : { height: MAX_PHOTO_EDGE }
  const out = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize }],
    { base64: true, compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  )
  return out.base64 ?? asset.base64 ?? ''
}

export async function pickPhoto(fromCamera = false): Promise<PickResult | null> {
  if (fromCamera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) return null
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 })
    if (result.canceled || !result.assets?.[0]) return null
    return { fileName: 'foto.jpg', fileMime: 'image/jpeg', fileB64: await photoToB64(result.assets[0]) }
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) return null
  const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 })
  if (result.canceled || !result.assets?.[0]) return null
  return { fileName: 'foto.jpg', fileMime: 'image/jpeg', fileB64: await photoToB64(result.assets[0]) }
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
  // Zoek de JSON-array op: gebruik '[{' en '}]' om tekst met losse [...] te omzeilen
  const startIdx = raw.lastIndexOf('[{')
  const endIdx   = raw.lastIndexOf('}]')
  if (startIdx !== -1 && endIdx > startIdx) {
    try { parsed = JSON.parse(raw.slice(startIdx, endIdx + 2)) } catch {}
  }
  // Fallback: probeer de eerste [...] in de tekst
  if (!parsed) {
    const m = raw.match(/\[[\s\S]*\]/)
    if (m) { try { parsed = JSON.parse(m[0]) } catch {} }
  }
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('Geen schema gevonden.')

  const rows = parsed
    .filter(r => r?.datum && /^\d{4}-\d{2}-\d{2}$/.test(r.datum))
    .map(r => ({
      datum: r.datum,
      type: normalizeType(r.type || 'run'),
      titel: String(r.titel || ''),
      detail: String(r.detail || ''),
      km: r.km != null ? Number(r.km) || null : null,
      fase: r.fase || '',
    }))

  return { schemaTitle, wekenStr, piekStr, rapport, rows }
}

// De backend streamt de schema-tekst (text/plain) zodat lange generaties (~2 min)
// de verbinding levend houden. Op web lezen we de stream chunk-voor-chunk voor
// echte voortgang; op native (geen getReader) bufferen we het hele antwoord.
async function readSchemaStream(res: Response, onProgress: (pct: number) => void): Promise<string> {
  const body = (res as unknown as { body?: ReadableStream<Uint8Array> }).body
  if (!body?.getReader) {
    const raw = await res.text()
    onProgress(95)
    return raw
  }
  const reader  = body.getReader()
  const decoder = new TextDecoder()
  let raw = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    raw += decoder.decode(value, { stream: true })
    // Echte voortgang, doorlopend vanaf ~40% (waar de wachttimer stopt) tot 95%.
    onProgress(Math.min(95, 40 + Math.round((raw.length / 14000) * 55)))
  }
  return raw
}

export async function analyseSchema(
  fileB64: string,
  fileMime: string,
  fileName: string,
  startDate: string,
  runDays: number[],
  keepRest: boolean,
  getToken: () => Promise<string | null>,
  onProgress: (pct: number) => void,
): Promise<AnalyseResult> {
  const userText = `Begindatum: ${startDate}.`

  const isImage = fileMime === 'image/jpeg' || fileMime === 'image/png'
  const isExcel = XLSX_MIMES.includes(fileMime)

  let userContent: object[]
  if (isImage) {
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: fileMime, data: fileB64 } },
      { type: 'text', text: userText },
    ]
  } else if (isExcel) {
    const csvText = excelToText(fileB64)
    userContent = [
      { type: 'text', text: csvText },
      { type: 'text', text: userText },
    ]
  } else {
    userContent = [
      { type: 'document', source: { type: 'base64', media_type: fileMime, data: fileB64 } },
      { type: 'text', text: userText },
    ]
  }

  // Wachttimer: loopt tot 40% zolang de backend het document leest en de eerste
  // tekst nog niet stroomt. Daarna neemt readSchemaStream de echte voortgang over.
  let pct = 0
  const progressTimer = setInterval(() => { pct = Math.min(pct + 3, 40); onProgress(pct) }, 200)

  try {
    const token = await getToken()
    const res = await fetch(`${IMPORT_BACKEND}/ai/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        // Geen fileB64 hier: het bestand zit al in userContent. De backend
        // leest het daar uit voor de import-log (scheelt de helft van de body).
        _meta: { fileName, fileMime, fileSize: base64Bytes(fileB64) },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      throw new Error(errBody?.error?.message ?? `Fout ${res.status}`)
    }
    clearInterval(progressTimer)
    const raw = await readSchemaStream(res, onProgress)
    return parseRawResponse(raw)
  } finally {
    clearInterval(progressTimer)
  }
}

export async function analyseSchemaFromUrl(
  url: string,
  startDate: string,
  runDays: number[],
  keepRest: boolean,
  getToken: () => Promise<string | null>,
  onProgress: (pct: number) => void,
): Promise<AnalyseResult> {
  const userText = `Begindatum: ${startDate}.`

  let pct = 0
  const progressTimer = setInterval(() => { pct = Math.min(pct + 3, 40); onProgress(pct) }, 200)

  try {
    const token = await getToken()
    const res = await fetch(`${IMPORT_BACKEND}/ai/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        _meta: { fileName: url, fileMime: 'text/csv' },
        url,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
      }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      throw new Error(errBody?.error?.message ?? `Fout ${res.status}`)
    }
    clearInterval(progressTimer)
    const raw = await readSchemaStream(res, onProgress)
    return parseRawResponse(raw)
  } finally {
    clearInterval(progressTimer)
  }
}

export async function importToBackend(
  rows: ParsedRow[],
  getToken: () => Promise<string | null>,
  onProgress: (pct: number) => void,
): Promise<{ schemaId: string; activities: Activity[] }> {
  const { id: schemaId } = await createSchema()

  const activities: Activity[] = []
  for (const row of rows) {
    const activity = await createActivity(schemaId, {
      datum: row.datum,
      type: row.type as ActivityType,
      titel: row.titel || null,
      detail: row.detail || null,
      km: row.km,
    })
    activities.push(activity)
  }

  onProgress(100)
  return { schemaId, activities }
}
