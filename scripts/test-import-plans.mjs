// Wegwerp-harnas: test alle plannen in runyo-claude/project-management/plans/
// door de import-wizard-flow na te bootsen. Draait vanuit runyo-app/ (gebruikt xlsx).
// Niet committen tenzij gewenst — dogfood-tool.
//
// Bootst getrouw runyo-app/src/services/import.ts na: zelfde request naar /ai/import,
// zelfde parse-logica (parseRawResponse / findRowsArray / normalizeType).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as xlsx from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLANS_DIR = path.resolve(__dirname, '../../runyo-claude/project-management/plans')
const IMPORT_BACKEND = 'https://runyo-auth-production.up.railway.app'

// ---- Constants overgenomen uit src/constants/activities.ts ----
const ACTIVITY_TYPES = ['run', 'work', 'strength', 'mobility', 'rest', 'race', 'recovery', 'swim', 'bike', 'gym']
const TYPE_NL_MAP = {
  hardlopen: 'run', lopen: 'run', rennen: 'run',
  werk: 'work', werken: 'work',
  kracht: 'strength', krachttraining: 'strength',
  mobiliteit: 'mobility', stretching: 'mobility',
  rust: 'rest', rustdag: 'rest',
  race: 'race', wedstrijd: 'race',
  herstel: 'recovery',
  zwemmen: 'swim', zwem: 'swim',
  fietsen: 'bike', fiets: 'bike',
  gym: 'gym',
}

// ---- SYSTEM_PROMPT overgenomen uit src/services/import.ts ----
const SYSTEM_PROMPT = `Je bent een schema-formatter. Zet een trainingsschema PRECIES over naar het app-formaat.

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

TRAININGSDAGEN — volg de instructie van de gebruiker:
- "Houd de trainingsdagen aan": neem de weekdagen exact over zoals in het document.
- "Plaats de trainingen op deze weekdagen: …": verschuif binnen elke week de trainingen
  (in dezelfde volgorde en met dezelfde inhoud) naar de opgegeven weekdagen. Vul de overige
  dagen met rust. Negeer de oorspronkelijke weekdagen uit het document.

Schrijf eerst TITEL: (max 30 tekens — naam van het schema).
Dan WEKEN: (getal, bijv. "12").
Dan PIEK: (hoogste weekvolume in km, bijv. "65 km").
Dan DAGEN: (vast als het brondocument echte vaste weekdagen heeft, geen als het een "dag 1, dag 2"-schema zonder weekdagen is).
Dan RAPPORT: (max 2 zinnen, beschrijf het schema neutraal).
Dan direct de JSON array, geen markdown.`

const XLSX_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]
const MB = 1024 * 1024
const MAX_FILE_BYTES = 20 * MB

// ---- Parse-logica, verbatim-port uit import.ts ----
function normalizeType(raw) {
  const lower = String(raw).toLowerCase().trim()
  if (ACTIVITY_TYPES.includes(lower)) return { type: lower, known: true }
  const mapped = TYPE_NL_MAP[lower]
  if (mapped) return { type: mapped, known: true }
  return { type: 'run', known: false }
}

function tryParseArray(s) {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : null } catch { return null }
}
function looksLikeRows(arr) {
  const first = arr[0]
  return arr.length > 0 && typeof first === 'object' && first !== null && 'datum' in first
}
function findRowsArray(raw) {
  const fenced = raw.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/i)
  if (fenced) { const arr = tryParseArray(fenced[1]); if (arr && looksLikeRows(arr)) return arr }
  let result = null
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
        if (arr && looksLikeRows(arr)) result = arr
        start = -1
      }
    }
  }
  if (result) return result
  const startIdx = raw.lastIndexOf('[{')
  const endIdx = raw.lastIndexOf('}]')
  if (startIdx !== -1 && endIdx > startIdx) {
    const arr = tryParseArray(raw.slice(startIdx, endIdx + 2)); if (arr) return arr
  }
  const m = raw.match(/\[[\s\S]*\]/)
  if (m) { const arr = tryParseArray(m[0]); if (arr) return arr }
  return null
}
function parseRawResponse(raw) {
  const titelM = raw.match(/TITEL\s*:\s*([^\n\r]{1,40})/i)
  const wekenM = raw.match(/WEKEN\s*:\s*(\d+)/i)
  const piekM = raw.match(/PIEK\s*:\s*([^\n\r]{1,20})/i)
  const dagenM = raw.match(/DAGEN\s*:\s*(vast|geen)/i)
  const rapportM = raw.match(/RAPPORT\s*:\s*([\s\S]*?)(?=\[|$)/i)
  const schemaTitle = titelM?.[1]?.trim() ?? ''
  const wekenStr = wekenM?.[1] ? `${wekenM[1]} weken` : ''
  const piekStr = piekM?.[1]?.trim() ?? ''
  const rapport = rapportM?.[1]?.trim() ?? ''
  const daysSignal = dagenM ? dagenM[1].toLowerCase() : null
  const parsed = findRowsArray(raw)
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('Geen schema gevonden.')
  const rows = parsed
    .filter(r => typeof r?.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.datum))
    .map(r => {
      const { type, known } = normalizeType(String(r.type ?? ''))
      return {
        datum: r.datum, type, titel: String(r.titel ?? ''), detail: String(r.detail ?? ''),
        km: r.km != null ? Number(r.km) || null : null,
        fase: typeof r.fase === 'string' ? r.fase : '',
        ...(known ? {} : { needsCheck: true }),
      }
    })
  return { schemaTitle, wekenStr, piekStr, rapport, rows, daysSignal }
}

// ---- Helpers ----
function excelToText(base64) {
  const wb = xlsx.read(base64, { type: 'base64' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return xlsx.utils.sheet_to_csv(sheet)
}
function mimeFor(file) {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.xlsx' || ext === '.xlsm') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (ext === '.xls') return 'application/vnd.ms-excel'
  if (ext === '.csv') return 'text/csv'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  return 'application/octet-stream'
}

const TODAY = new Date().toISOString().slice(0, 10)
const USER_TEXT = `Begindatum: ${TODAY}. Houd de trainingsdagen uit het schema exact aan.`

async function postImport(body) {
  const res = await fetch(`${IMPORT_BACKEND}/ai/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => null)
    throw new Error(errBody?.error?.message ?? `Fout ${res.status}`)
  }
  return await res.text() // hele stream bufferen
}

async function analyseFile(filePath) {
  const mime = mimeFor(filePath)
  const buf = fs.readFileSync(filePath)
  const bytes = buf.length
  if (bytes > MAX_FILE_BYTES) {
    return { status: 'BLOCKED', note: `${(bytes / MB).toFixed(0)} MB > 20 MB` }
  }
  const b64 = buf.toString('base64')
  let content
  if (mime === 'image/jpeg' || mime === 'image/png') {
    content = [{ type: 'image', source: { type: 'base64', media_type: mime, data: b64 } }, { type: 'text', text: USER_TEXT }]
  } else if (XLSX_MIMES.includes(mime)) {
    const csv = excelToText(b64)
    content = [{ type: 'text', text: csv }, { type: 'text', text: USER_TEXT }]
  } else {
    content = [{ type: 'document', source: { type: 'base64', media_type: mime, data: b64 } }, { type: 'text', text: USER_TEXT }]
  }
  const raw = await postImport({
    _meta: { fileName: path.basename(filePath), fileMime: mime, fileSize: bytes },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  })
  return parseRawResponse(raw)
}

async function analyseUrl(url) {
  const raw = await postImport({
    _meta: { fileName: url, fileMime: 'text/csv' },
    url,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: [{ type: 'text', text: USER_TEXT }] }],
  })
  return parseRawResponse(raw)
}

function fmt(s, w) { return String(s ?? '').slice(0, w).padEnd(w) }

async function main() {
  const entries = fs.readdirSync(PLANS_DIR)
    .filter(f => /\.(pdf|xlsx|xlsm|xls|csv|jpe?g|png)$/i.test(f))
    .sort()
  const sheetUrls = fs.existsSync(path.join(PLANS_DIR, 'gsheets.txt'))
    ? fs.readFileSync(path.join(PLANS_DIR, 'gsheets.txt'), 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    : []

  const targets = [
    ...entries.map(f => ({ kind: 'file', label: f, path: path.join(PLANS_DIR, f) })),
    ...sheetUrls.map((u, i) => ({ kind: 'url', label: `gsheet ${i + 1}`, url: u })),
  ]

  console.log(`\n${targets.length} doelen — begindatum ${TODAY}\n`)
  const results = []
  for (const t of targets) {
    process.stdout.write(`→ ${t.label} ... `)
    const started = Date.now()
    try {
      const r = t.kind === 'file' ? await analyseFile(t.path) : await analyseUrl(t.url)
      const secs = ((Date.now() - started) / 1000).toFixed(0)
      if (r.status === 'BLOCKED') {
        console.log(`BLOCKED (${r.note})`)
        results.push({ label: t.label, status: 'BLOCKED', note: r.note })
      } else {
        const needsCheck = r.rows.filter(x => x.needsCheck).length
        const notes = []
        if (needsCheck) notes.push(`${needsCheck} type-check`)
        if (!r.rows.length) notes.push('0 rijen')
        console.log(`OK — ${r.rows.length} rijen (${secs}s)`)
        results.push({
          label: t.label, status: r.rows.length ? 'OK' : 'GEEN SCHEMA',
          rows: r.rows.length, weken: r.wekenStr, piek: r.piekStr,
          dagen: r.daysSignal ?? '', note: notes.join(', '),
        })
      }
    } catch (err) {
      const secs = ((Date.now() - started) / 1000).toFixed(0)
      const msg = err.message || String(err)
      const status = /Geen schema gevonden/i.test(msg) ? 'GEEN SCHEMA' : 'FOUT'
      console.log(`${status} — ${msg} (${secs}s)`)
      results.push({ label: t.label, status, note: status === 'FOUT' ? msg : '' })
    }
  }

  // ---- Samenvattingstabel ----
  console.log('\n' + '='.repeat(110))
  console.log(`${fmt('Plan', 44)} ${fmt('Status', 12)} ${fmt('Rijen', 6)} ${fmt('Weken', 9)} ${fmt('Piek', 8)} ${fmt('Dagen', 6)} Let op`)
  console.log('-'.repeat(110))
  for (const r of results) {
    console.log(`${fmt(r.label, 44)} ${fmt(r.status, 12)} ${fmt(r.rows ?? '', 6)} ${fmt(r.weken ?? '', 9)} ${fmt(r.piek ?? '', 8)} ${fmt(r.dagen ?? '', 6)} ${r.note ?? ''}`)
  }
  console.log('='.repeat(110))
  const by = s => results.filter(r => r.status === s).length
  console.log(`Totaal: ${results.length} | OK ${by('OK')} | GEEN SCHEMA ${by('GEEN SCHEMA')} | BLOCKED ${by('BLOCKED')} | FOUT ${by('FOUT')}\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
