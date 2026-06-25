// runyo schema import service — pure orchestration, no UI imports.
// All I/O with the filesystem, image picker, and backend lives here.
// The ImportWizard screen is the only caller.

import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'
import type * as xlsx from 'xlsx'
import { createSchema, deleteSchema, type SchemaSpan } from './schemas'
import { createActivitiesBatch, type ActivityCreateInput } from './activities'
import { TYPE_NL_MAP, ACTIVITY_TYPES } from '@/constants/activities'
import { fromDateString, toDateString, addDays } from '@/utils/date'
import type { Activity, ActivityType, IntervalBlock, IntervalUnit } from '@/types/activity'

// Geldige interval-eenheden, gespiegeld aan de backend-normalizeIntervals.
const INTERVAL_UNITS: readonly IntervalUnit[] = ['m', 'km', 's', 'min']

// Trainingsdagen-keuze uit de wizard. 'keep' = dagen uit het document aanhouden;
// 'choose' = trainingen naar de gekozen weekdagen verschuiven (0=ma … 6=zo).
export type DayMode =
  | { mode: 'keep' }
  | { mode: 'choose'; days: number[] }

const WEEKDAY_LABELS = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']

// Bouw het per-import userText (system blijft cachebaar). De dag-modus bepaalt of
// de analyse de dagen aanhoudt of de trainingen naar de gekozen weekdagen schuift.
function buildUserText(startDate: string, dayMode: DayMode): string {
  if (dayMode.mode === 'choose' && dayMode.days.length > 0) {
    const labels = [...dayMode.days].sort((a, b) => a - b).map(i => WEEKDAY_LABELS[i]).join(', ')
    return `Begindatum: ${startDate}. Plaats de trainingen van elke week op deze weekdagen (op volgorde): ${labels}. Laat de overige dagen weg (de app vult ze met rust). Negeer de weekdagen uit het document.`
  }
  return `Begindatum: ${startDate}. Houd de trainingsdagen uit het schema exact aan.`
}

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

Geef de output als JSON-array van compacte objecten met KORTE keys (dit bespaart ruimte):
- d: datum YYYY-MM-DD (verplicht)
- t: type (run|kracht|mobiliteit|herstel|werk|race) — zie de rustregel hieronder
- ti: titel (max 70 tekens)
- de: detail (max 500 tekens — kopieer ZO LETTERLIJK MOGELIJK, niet inkorten)
- k: km als getal, of laat de key weg

Optionele keys (alleen invullen als ze LETTERLIJK in de bron staan, anders weglaten):
- tp: doeltempo als vrije tekst, bv. "4:30".
- th: doelhartslag als getal (bpm), bv. 150.
- iv: array van interval-/blokobjecten, óók met korte keys: {r: herhalingen (getal), dk: afstand in km (getal), dm: duur in min (getal), p: tempo (tekst), rc: rust (tekst), l: label (tekst)}.
- Voor type "race": rt: raceType (afstand/soort), gt: goalTime (doeltijd, bv. "37:30"), mg: true als het schema deze race als hoofddoel markeert.
Staat er geen tempo/hartslag/interval/doeltijd → laat de key weg. NOOIT verzinnen of afleiden.
Behoud de oorspronkelijke omschrijving ALTIJD óók letterlijk in de — de optionele keys zijn een aanvulling, geen vervanging.
Interval-afstanden in meters (bv. "600", "8x400m") → dk in km (600 m = 0,6). De pace van een intervalblok hoort in het blok (p); tp alleen voor een tempo dat voor de hele sessie geldt.

Regels:
1. Begindatum opgegeven door gebruiker = dag 1 van week 1. Elke week +7 dagen.
2. LAAT RUSTDAGEN WEG: lege dagen, "rust", "vrij", "off", "REST" geef je NIET als item — de app vult ontbrekende datums automatisch met rust. Geef een rust- of hersteldag ALLEEN als er een eigen instructie bij hoort (bv. "rust, foam rollen") → dan t=herstel of t=rust met die tekst in de.
3. Cross-Training → mobiliteit.
4. Output: chronologisch. Alleen dagen met een training of een specifieke instructie. Meerdere sessies op één dag (bv. 2 runs, of 1 run + 1 kracht) → meerdere losse items met dezelfde datum, NIET samenvoegen.

TRAININGSDAGEN — volg de instructie van de gebruiker:
- "Houd de trainingsdagen aan": neem de weekdagen exact over zoals in het document.
- "Plaats de trainingen op deze weekdagen: …": verschuif binnen elke week de trainingen
  (in dezelfde volgorde en met dezelfde inhoud) naar de opgegeven weekdagen. Laat de overige
  dagen weg (de app vult ze met rust). Negeer de oorspronkelijke weekdagen uit het document.

Schrijf eerst TITEL: (max 30 tekens — naam van het schema).
Dan WEKEN: (totaal aantal weken in het schema, bijv. "12" — telt ook lege/rustweken mee zodat de app de juiste lengte aanvult).
Dan DAGEN: (vast als het brondocument echte vaste weekdagen heeft, geen als het een "dag 1, dag 2"-schema zonder weekdagen is).
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
// `known` is false als het type onbekend is (BUG11): dan vallen we terug op 'run'
// maar markeren we de rij zodat de gebruiker hem kan controleren.
function normalizeType(raw: string): { type: ActivityType; known: boolean } {
  const lower = raw.toLowerCase().trim()
  if ((ACTIVITY_TYPES as readonly string[]).includes(lower)) return { type: lower as ActivityType, known: true }
  const mapped = TYPE_NL_MAP[lower]
  if (mapped) return { type: mapped, known: true }
  return { type: 'run', known: false }
}

export type ParsedRow = {
  datum: string
  type: string
  titel: string
  detail: string
  km: number | null
  fase: string
  // BUG11: gezet als het brontype onbekend was en stil naar 'run' viel → check-badge.
  needsCheck?: boolean
  // Optionele sessie-/race-velden — alleen aanwezig als ze letterlijk in de bron
  // stonden. We sturen ze door naar de backend; afwezig = leeg laten.
  targetPace?: string | null
  targetHr?: number | null
  intervals?: IntervalBlock[] | null
  raceType?: string | null
  goalTime?: string | null
  isMainGoal?: boolean
}

export type PickResult = {
  fileName: string
  fileMime: string
  fileB64: string
}

export type AnalyseResult = {
  schemaTitle: string
  wekenStr: string
  rapport: string
  rows: ParsedRow[]
  // DAGEN-signaal uit de analyse: 'vast' = brondocument had echte weekdagen,
  // 'geen' = "dag 1, dag 2"-schema. Voedt de review-nudge. null = niet teruggegeven.
  daysSignal: 'vast' | 'geen' | null
  // True als de generatie op het max_tokens-plafond is afgekapt (B1): het schema
  // kan onvolledig zijn. De backend hangt hiervoor een sentinel aan de stream.
  truncated: boolean
}

// Duidelijke melding wanneer een Excel-bestand niets bruikbaars oplevert
// (macro-bestand, leeg/beschermd of schema op een ander tabblad). We fixen die
// gevallen niet diepgeworteld, maar geven concrete quickfixes — herkenbaar aan
// het begin "Dit Excel-bestand" zodat het scherm de tekst integraal toont.
export const EXCEL_HELP =
  'Dit Excel-bestand konden we niet lezen. Een paar snelle oplossingen:\n' +
  '• Zet het schema op het eerste tabblad, of kopieer dat tabblad naar een leeg bestand.\n' +
  '• Sla op als gewone .xlsx zonder macro\'s (niet als .xlsm).\n' +
  '• Of exporteer het als openbare Google Sheet en plak de link.'

export async function excelToText(base64: string): Promise<string> {
  // Lazy-load: de xlsx-library (~430KB) wordt pas opgehaald wanneer een
  // gebruiker daadwerkelijk een Excel-bestand importeert (≈1% van de sessies).
  // Metro splitst dit in een eigen web-chunk i.p.v. de koude-start-bundle.
  const xlsxMod = await import('xlsx')
  const xlsx = (xlsxMod.default ?? xlsxMod) as typeof import('xlsx')
  let wb: xlsx.WorkBook
  try {
    wb = xlsx.read(base64, { type: 'base64' })
  } catch {
    throw new Error(EXCEL_HELP)
  }
  const sheetName = wb.SheetNames[0]
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined
  const csv = sheet ? xlsx.utils.sheet_to_csv(sheet) : ''
  // Een leeg of macro-tabblad geeft alleen komma's/witregels terug; stop dan
  // meteen i.p.v. een minutenlange analyse op een lege CSV te starten.
  if (csv.replace(/[\s,]/g, '').length < 15) {
    throw new Error(EXCEL_HELP)
  }
  return csv
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

function tryParseArray(s: string): unknown[] | null {
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

function looksLikeRows(arr: unknown[]): boolean {
  const first = arr[0]
  return arr.length > 0 && typeof first === 'object' && first !== null && ('datum' in first || 'd' in first)
}

// B3: het model levert compacte rijen met KORTE keys (d/t/ti/de/k + tp/th/iv/rt/gt/mg).
// We mappen ze hier terug naar de interne lange namen, zodat de rest van de parser én
// alle downstream-code ongewijzigd blijft. Oude verbose responses (lange keys) en oude
// import-logs blijven werken: bij een lange key valt de korte gewoon weg (4A, backwards-compat).
function pick(o: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) if (o[k] !== undefined) return o[k]
  return undefined
}

function normalizeIntervalKeys(block: unknown): unknown {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return block
  const o = block as Record<string, unknown>
  const out: Record<string, unknown> = {}
  const map: Record<string, string[]> = {
    id: ['id'], label: ['label', 'l'], repeat: ['repeat', 'r'],
    distanceKm: ['distanceKm', 'dk'], durationMin: ['durationMin', 'dm'],
    amountUnit: ['amountUnit', 'u'], pace: ['pace', 'p'], recovery: ['recovery', 'rc'],
  }
  for (const long in map) {
    const v = pick(o, ...map[long])
    if (v !== undefined) out[long] = v
  }
  return out
}

function normalizeRowKeys(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}
  const map: Record<string, string[]> = {
    datum: ['datum', 'd'], type: ['type', 't'], titel: ['titel', 'ti'],
    detail: ['detail', 'de'], km: ['km', 'k'], fase: ['fase', 'f'],
    targetPace: ['targetPace', 'tp'], targetHr: ['targetHr', 'th'],
    raceType: ['raceType', 'rt'], goalTime: ['goalTime', 'gt'], isMainGoal: ['isMainGoal', 'mg'],
  }
  for (const long in map) {
    const v = pick(o, ...map[long])
    if (v !== undefined) out[long] = v
  }
  const intervals = pick(o, 'intervals', 'iv')
  if (Array.isArray(intervals)) out.intervals = intervals.map(normalizeIntervalKeys)
  else if (intervals !== undefined) out.intervals = intervals
  return out
}

// B3: het model laat lege rustdagen weg om tokens te besparen. We reconstrueren ze hier
// client-side zodat de geïmporteerde rijen identiek zijn aan vroeger (gedrag ongewijzigd,
// alleen de model-output is compacter). De span loopt van de begindatum tot de latere van
// (begindatum + weken·7 − 1) en de laatste trainingsdatum. Datums zonder rij → type rest.
// Een rustdag MÉT inhoud staat al als rij in de output en wordt dus niet overschreven.
function fillRestDays(rows: ParsedRow[], startDate: string, weken: number): ParsedRow[] {
  const start = fromDateString(startDate)
  if (isNaN(start.getTime()) || rows.length === 0) return rows
  const have = new Set(rows.map(r => r.datum))
  const lastIso = rows.reduce((m, r) => (r.datum > m ? r.datum : m), startDate)
  let endDate = fromDateString(lastIso)
  if (weken > 0) {
    const wkEnd = addDays(start, weken * 7 - 1)
    if (wkEnd.getTime() > endDate.getTime()) endDate = wkEnd
  }
  const out = [...rows]
  for (let d = start; d.getTime() <= endDate.getTime(); d = addDays(d, 1)) {
    const iso = toDateString(d)
    if (!have.has(iso)) out.push({ datum: iso, type: 'rest', titel: '', detail: '', km: null, fase: '' })
  }
  return out.sort((a, b) => a.datum.localeCompare(b.datum))
}

/**
 * Vind de JSON-array met rijen in een vrije-tekst-respons. Hardening van de oude
 * `lastIndexOf('[{')`: die brak af als het RAPPORT zelf `[...]` bevatte.
 * Volgorde: (1) fenced ```json-blok, (2) gebalanceerde scan op string-veilige
 * `[...]`-regio's (laatste die op rijen lijkt wint), (3) oude heuristiek als fallback.
 */
function findRowsArray(raw: string): unknown[] | null {
  // 1. Fenced code block — ```json […] ``` of ``` […] ```
  const fenced = raw.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/i)
  if (fenced) {
    const arr = tryParseArray(fenced[1])
    if (arr && looksLikeRows(arr)) return arr
  }

  // 2. Gebalanceerde scan: tel '['/']' op diepte 0, met string-/escape-bewustzijn,
  //    zodat haakjes binnen strings of het rapport ons niet misleiden.
  let result: unknown[] | null = null
  let inStr = false, esc = false, depth = 0, start = -1
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === '[') { if (depth === 0) start = i; depth++ }
    else if (ch === ']' && depth > 0) {
      depth--
      if (depth === 0 && start !== -1) {
        const arr = tryParseArray(raw.slice(start, i + 1))
        if (arr && looksLikeRows(arr)) result = arr // laatste passende array wint
        start = -1
      }
    }
  }
  if (result) return result

  // 3. Fallback: oude heuristiek.
  const startIdx = raw.lastIndexOf('[{')
  const endIdx = raw.lastIndexOf('}]')
  if (startIdx !== -1 && endIdx > startIdx) {
    const arr = tryParseArray(raw.slice(startIdx, endIdx + 2))
    if (arr) return arr
  }
  const m = raw.match(/\[[\s\S]*\]/)
  if (m) {
    const arr = tryParseArray(m[0])
    if (arr) return arr
  }
  return null
}

/**
 * Spiegelt de backend-`normalizeIntervals` (runyo-auth/routes/activities.ts:67):
 * valideert een array van blokken {repeat, distanceKm|durationMin, pace, recovery}.
 * Bij élke vormfout dropt het hele veld naar null — we sturen liever niets dan een
 * rij die de backend met een 400 zou weigeren en zo de hele batch laat falen.
 * Genereert zelf een `id` per blok (de bron levert die niet, de backend vereist een
 * niet-lege string-id); geen Math.random zodat de output deterministisch blijft.
 */
export function sanitizeIntervals(value: unknown): IntervalBlock[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const out: IntervalBlock[] = []
  for (let i = 0; i < value.length; i++) {
    const item = value[i]
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const block = item as Record<string, unknown>
    // repeat: optioneel; aanwezig → eindig getal ≥ 1.
    let repeat = 1
    if (block.repeat !== undefined && block.repeat !== null) {
      if (typeof block.repeat !== 'number' || !Number.isFinite(block.repeat) || block.repeat < 1) return null
      repeat = block.repeat
    }
    // label/pace/recovery: optionele strings.
    for (const f of ['label', 'pace', 'recovery'] as const) {
      if (block[f] !== undefined && block[f] !== null && typeof block[f] !== 'string') return null
    }
    // distanceKm/durationMin: optionele getallen ≥ 0.
    for (const f of ['distanceKm', 'durationMin'] as const) {
      if (block[f] !== undefined && block[f] !== null) {
        if (typeof block[f] !== 'number' || !Number.isFinite(block[f]) || (block[f] as number) < 0) return null
      }
    }
    // amountUnit: optioneel; aanwezig → één van de vier eenheden.
    let amountUnit: IntervalUnit | null = null
    if (block.amountUnit !== undefined && block.amountUnit !== null) {
      if (!INTERVAL_UNITS.includes(block.amountUnit as IntervalUnit)) return null
      amountUnit = block.amountUnit as IntervalUnit
    }
    out.push({
      id: typeof block.id === 'string' && block.id.length > 0 ? block.id : `intv-${i}`,
      label: (block.label as string | undefined) ?? null,
      repeat,
      distanceKm: (block.distanceKm as number | undefined) ?? null,
      durationMin: (block.durationMin as number | undefined) ?? null,
      amountUnit,
      pace: (block.pace as string | undefined) ?? null,
      recovery: (block.recovery as string | undefined) ?? null,
    })
  }
  return out
}

/**
 * Parse the raw text response from the backend into structured AnalyseResult.
 * Pure function — safe to unit-test without mocking fetch.
 */
export function parseRawResponse(raw: string, startDate?: string): AnalyseResult {
  // B1: de backend hangt deze sentinel aan de stream als de generatie op het
  // max_tokens-plafond is afgekapt → schema mogelijk onvolledig.
  const truncated = raw.includes('RUNYO_TRUNCATED_MAXTOKENS')

  const titelM   = raw.match(/TITEL\s*:\s*([^\n\r]{1,40})/i)
  const wekenM   = raw.match(/WEKEN\s*:\s*(\d+)/i)
  const dagenM   = raw.match(/DAGEN\s*:\s*(vast|geen)/i)
  const rapportM = raw.match(/RAPPORT\s*:\s*([\s\S]*?)(?=\[|$)/i)

  const schemaTitle = titelM?.[1]?.trim() ?? ''
  const wekenStr    = wekenM?.[1] ? `${wekenM[1]} weken` : ''
  const weken       = wekenM?.[1] ? parseInt(wekenM[1], 10) : 0
  const rapport     = rapportM?.[1]?.trim() ?? ''
  const daysSignal  = dagenM ? (dagenM[1].toLowerCase() as 'vast' | 'geen') : null

  const rawArr = findRowsArray(raw) as unknown[] | null
  if (!Array.isArray(rawArr) || !rawArr.length) {
    // Afgekapt vóór een bruikbare array → geen generieke "geen schema", maar een
    // melding die de echte oorzaak benoemt (schema te lang).
    throw new Error(truncated
      ? 'Het schema was te lang en is afgekapt voordat het compleet was. Probeer een korter schema, of splits het in delen.'
      : 'Geen schema gevonden.')
  }

  // B3: korte/compacte keys → interne lange namen mappen (verbose blijft werken).
  const parsed = rawArr.map(normalizeRowKeys)

  const rows: ParsedRow[] = parsed
    .filter(r => typeof r?.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.datum))
    .map(r => {
      const { type, known } = normalizeType(String(r.type ?? ''))
      // Optionele velden: leniente extractie, client-side gespiegeld aan de
      // backend-validatie. Aanwezig+fout → naar null/weglaten (faalt de import nooit).
      const targetPace = typeof r.targetPace === 'string' && r.targetPace.trim() ? r.targetPace.trim() : null
      const targetHr = Number.isInteger(r.targetHr) && (r.targetHr as number) >= 20 && (r.targetHr as number) <= 260
        ? (r.targetHr as number) : null
      const intervals = sanitizeIntervals(r.intervals)
      const raceType = typeof r.raceType === 'string' && r.raceType.trim() ? r.raceType.trim() : null
      const goalTime = typeof r.goalTime === 'string' && r.goalTime.trim() ? r.goalTime.trim() : null
      const isMainGoal = type === 'race' && r.isMainGoal === true
      return {
        datum: r.datum as string,
        type,
        titel: String(r.titel ?? ''),
        detail: String(r.detail ?? ''),
        km: r.km != null ? Number(r.km) || null : null,
        fase: typeof r.fase === 'string' ? r.fase : '',
        ...(known ? {} : { needsCheck: true }),
        ...(targetPace ? { targetPace } : {}),
        ...(targetHr != null ? { targetHr } : {}),
        ...(intervals ? { intervals } : {}),
        ...(raceType ? { raceType } : {}),
        ...(goalTime ? { goalTime } : {}),
        ...(isMainGoal ? { isMainGoal } : {}),
      }
    })

  // B3: het model laat lege rustdagen weg → hier weer aanvullen, zodat de
  // geïmporteerde rijen (en de review-weergave) identiek blijven aan vroeger.
  const filled = startDate ? fillRestDays(rows, startDate, weken) : rows

  return { schemaTitle, wekenStr, rapport, rows: filled, daysSignal, truncated }
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
  dayMode: DayMode,
  getToken: () => Promise<string | null>,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<AnalyseResult> {
  const userText = buildUserText(startDate, dayMode)

  const isImage = fileMime === 'image/jpeg' || fileMime === 'image/png'
  const isExcel = XLSX_MIMES.includes(fileMime)

  let userContent: object[]
  if (isImage) {
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: fileMime, data: fileB64 } },
      { type: 'text', text: userText },
    ]
  } else if (isExcel) {
    const csvText = await excelToText(fileB64)
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
    const res = await fetch(`${IMPORT_BACKEND}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        // Geen fileB64 hier: het bestand zit al in userContent. De backend
        // leest het daar uit voor de import-log (scheelt de helft van de body).
        _meta: { fileName, fileMime, fileSize: base64Bytes(fileB64) },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal,
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      throw new Error(errBody?.error?.message ?? `Fout ${res.status}`)
    }
    clearInterval(progressTimer)
    const raw = await readSchemaStream(res, onProgress)
    return parseRawResponse(raw, startDate)
  } finally {
    clearInterval(progressTimer)
  }
}

export async function analyseSchemaFromUrl(
  url: string,
  startDate: string,
  dayMode: DayMode,
  getToken: () => Promise<string | null>,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<AnalyseResult> {
  const userText = buildUserText(startDate, dayMode)

  let pct = 0
  const progressTimer = setInterval(() => { pct = Math.min(pct + 3, 40); onProgress(pct) }, 200)

  try {
    const token = await getToken()
    const res = await fetch(`${IMPORT_BACKEND}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        _meta: { fileName: url, fileMime: 'text/csv' },
        url,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
      }),
      signal,
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      throw new Error(errBody?.error?.message ?? `Fout ${res.status}`)
    }
    clearInterval(progressTimer)
    const raw = await readSchemaStream(res, onProgress)
    return parseRawResponse(raw, startDate)
  } finally {
    clearInterval(progressTimer)
  }
}

export async function importToBackend(
  rows: ParsedRow[],
  getToken: () => Promise<string | null>,
  onProgress: (pct: number) => void,
  schemaName?: string,
  span?: SchemaSpan,
): Promise<{ schemaId: string; activities: Activity[] }> {
  // Schema pas hier aanmaken (op "Schema importeren"), zodat een mislukte analyse
  // nooit een leeg schema achterlaat. De vaste plan-span (start + weekduur) wordt
  // meteen meegegeven zodat de looptijd niet meer uit de datums hoeft.
  const { id: schemaId } = await createSchema(schemaName || 'Leeg schema', span)

  try {
    const inputs: ActivityCreateInput[] = rows.map(row => ({
      datum: row.datum,
      type: row.type as ActivityType,
      titel: row.titel || null,
      detail: row.detail || null,
      km: row.km,
      targetPace: row.targetPace ?? null,
      targetHr: row.targetHr ?? null,
      intervals: row.intervals ?? null,
      raceType: row.raceType ?? null,
      goalTime: row.goalTime ?? null,
      isMainGoal: row.isMainGoal ?? false,
    }))
    // Eén transactie op de backend (all-or-nothing) i.p.v. N sequentiële POSTs.
    const activities = await createActivitiesBatch(schemaId, inputs)
    onProgress(100)
    return { schemaId, activities }
  } catch (err) {
    // Rollback: ruim het zojuist aangemaakte (lege) schema op bij een batch-fout.
    try { await deleteSchema(schemaId) } catch {}
    throw err
  }
}
