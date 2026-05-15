import { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Switch, ActivityIndicator,
} from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { ModalSheet } from '@/components/shared/ModalSheet'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { createNewSheet, todaySchemaName } from '@/services/drive'
import { appendActivity, verifyOrFixHeaders, getSheetTabId, sortSheet } from '@/services/sheets'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import type { ActivityType } from '@/constants/activities'

const BACKEND = 'https://runyo-auth-production.up.railway.app'
const DAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

const SYSTEM_PROMPT = `Je krijgt een trainingsschema (PDF, afbeelding, Excel of tekst).

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

type Step = 'source' | 'picked' | 'processing' | 'preview' | 'success'
type Source = 'pdf' | 'excel' | 'foto'

type ParsedRow = {
  datum: string; type: string; titel: string; detail: string; km: number | null; fase: string
}

// ── Circular progress (SVG) ───────────────────────────────────────────────
function CircleProgress({ pct, size = 80, color }: { pct: number; size: number; color: string }) {
  const r   = (size - 12) / 2
  const circ = 2 * Math.PI * r
  return (
    <Svg width={size} height={size}>
      <Circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={6} />
      <Circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${circ * pct / 100} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        rotation={-90} originX={size/2} originY={size/2}
      />
    </Svg>
  )
}

// ── Recognised info card ──────────────────────────────────────────────────
function InfoCard({ label, value, p }: { label: string; value: string; p: any }) {
  return (
    <View style={[styles.infoCard, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Text style={[styles.infoLabel, { color: p.text }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: p.muted }]}>{value}</Text>
    </View>
  )
}

export function ImportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme      = useTheme()
  const getToken   = useAuthStore(s => s.getToken)
  const setSchema  = useDataStore(s => s.setSchema)

  const [step,        setStep]        = useState<Step>('source')
  const [source,      setSource]      = useState<Source>('pdf')
  const [fileName,    setFileName]    = useState('')
  const [fileB64,     setFileB64]     = useState('')
  const [fileMime,    setFileMime]    = useState('')
  const [progress,    setProgress]    = useState(0)
  const [schemaTitle, setSchemaTitle] = useState('')
  const [wekenStr,    setWekenStr]    = useState('')
  const [piekStr,     setPiekStr]     = useState('')
  const [rapport,     setRapport]     = useState('')
  const [preview,     setPreview]     = useState<ParsedRow[]>([])
  const [error,       setError]       = useState('')
  const [startDate,   setStartDate]   = useState(new Date().toISOString().split('T')[0])
  const [runDays,     setRunDays]     = useState([0, 2, 4])
  const [keepRest,    setKeepRest]    = useState(true)
  const [showConfig,  setShowConfig]  = useState(false)

  function reset() {
    setStep('source'); setFileName(''); setFileB64(''); setFileMime(''); setProgress(0)
    setSchemaTitle(''); setWekenStr(''); setPiekStr(''); setRapport(''); setPreview([])
    setError(''); setShowConfig(false)
    setStartDate(new Date().toISOString().split('T')[0])
    setRunDays([0, 2, 4]); setKeepRest(true)
  }

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      setFileName(asset.name)
      setFileMime(asset.mimeType ?? 'application/pdf')
      setFileB64('')
      setStep('picked')
      const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
      setFileB64(b64)
    } catch (e: any) {
      setError(`Bestand laden mislukt: ${e?.message ?? ''}`)
    }
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setFileName('foto.jpg'); setFileMime('image/jpeg')
    setFileB64(asset.base64 ?? ''); setStep('picked')
  }

  async function pickCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) return
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setFileName('foto.jpg'); setFileMime('image/jpeg')
    setFileB64(asset.base64 ?? ''); setStep('picked')
  }

  function handleSourceTap(s: Source) {
    setSource(s)
    if (s === 'pdf' || s === 'excel') pickFile()
    else pickPhoto()
  }

  async function analyse() {
    if (!fileB64) { setError('Wacht tot het bestand geladen is.'); return }
    setStep('processing'); setProgress(0); setError('')

    const dayNames = DAY_LABELS.filter((_, i) => runDays.includes(i)).join(', ')
    const userText = `Begindatum: ${startDate}. Hardloopdagen: ${dayNames}. Rustdagen behouden: ${keepRest ? 'ja' : 'nee'}.`

    let userContent: unknown
    if (fileMime === 'image/jpeg' || fileMime === 'image/png') {
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: fileMime, data: fileB64 } },
        { type: 'text', text: userText },
      ]
    } else {
      userContent = [
        { type: 'document', source: { type: 'base64', media_type: fileMime, data: fileB64 } },
        { type: 'text', text: userText },
      ]
    }

    // Animate progress ring while fetching
    const timer = setInterval(() => setProgress(p => Math.min(p + 3, 85)), 200)

    try {
      const token = await getToken()
      const res = await fetch(`${BACKEND}/ai/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ system: SYSTEM_PROMPT, messages: [{ role: 'user', content: userContent }] }),
      })
      if (!res.ok) throw new Error(`Fout ${res.status}`)
      const json = await res.json() as { content: { text: string }[] }
      const raw = json.content?.[0]?.text ?? ''

      setProgress(95)

      const titelM  = raw.match(/TITEL\s*:\s*([^\n\r]{1,40})/i)
      const wekenM  = raw.match(/WEKEN\s*:\s*(\d+)/i)
      const piekM   = raw.match(/PIEK\s*:\s*([^\n\r]{1,20})/i)
      const rapportM = raw.match(/RAPPORT\s*:\s*([\s\S]*?)(?=\[|$)/i)

      setSchemaTitle(titelM?.[1]?.trim() ?? '')
      setWekenStr(wekenM?.[1] ? `${wekenM[1]} weken` : '')
      setPiekStr(piekM?.[1]?.trim() ?? '')
      setRapport(rapportM?.[1]?.trim() ?? '')

      let parsed: ParsedRow[] | null = null
      const m = raw.match(/\[[\s\S]*\]/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch {} }

      if (!Array.isArray(parsed) || !parsed.length) throw new Error('Geen schema gevonden.')

      const rows = parsed
        .filter(r => r?.datum && /^\d{4}-\d{2}-\d{2}$/.test(r.datum))
        .map(r => ({ datum: r.datum, type: r.type || 'run', titel: String(r.titel || ''), detail: String(r.detail || ''), km: r.km != null ? Number(r.km) || null : null, fase: r.fase || '' }))

      setPreview(rows); setProgress(100)
      setStep('preview')
    } catch (e: any) {
      setError(e.message ?? 'Analyse mislukt'); setStep('picked')
    } finally {
      clearInterval(timer)
    }
  }

  async function confirm() {
    setStep('processing'); setProgress(0)
    const token = await getToken()
    if (!token) { setError('Niet ingelogd'); setStep('preview'); return }
    try {
      const d = new Date()
      const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
      const titlePart = schemaTitle ? `${schemaTitle} ` : ''
      const baseName = `runyo schema ${titlePart}${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
      const entry = await createNewSheet(token, baseName)
      await verifyOrFixHeaders(entry.id, 'Schema', token)

      const timer = setInterval(() => setProgress(p => Math.min(p + 2, 90)), 300)
      for (const row of preview) {
        await appendActivity(entry.id, 'Schema', token, {
          datum: row.datum, type: row.type as ActivityType,
          titel: row.titel, detail: row.detail,
          km: row.km, feedback: null, fase: row.fase, raceType: null,
        })
      }
      clearInterval(timer)
      const tabId = await getSheetTabId(entry.id, 'Schema', token).catch(() => 0)
      if (tabId) await sortSheet(entry.id, tabId, token).catch(() => {})
      await setSchema(entry.id, 'Schema', entry.name, tabId)
      setProgress(100); setStep('success')
    } catch (e: any) {
      setError(e.message ?? 'Importeren mislukt'); setStep('preview')
    }
  }

  const p = theme  // alias for brevity

  return (
    <ModalSheet visible={visible} title="Schema laden" onClose={() => { reset(); onClose() }}>

      {/* ── Frame 2: source selection ─────────────────────────────── */}
      {step === 'source' && (
        <View style={styles.column}>
          <Text style={[styles.sectionLabel, { color: p.muted }]}>kies je bron</Text>

          {/* PDF — primary tile */}
          <TouchableOpacity style={[styles.tile, styles.tilePrimary, { backgroundColor: p.accent, borderColor: p.accent }]} onPress={() => handleSourceTap('pdf')}>
            <View style={styles.tileBody}>
              <Text style={[styles.tileTitle, { color: p.accentInk }]}>PDF</Text>
              <Text style={[styles.tileSub, { color: p.accentInk, opacity: 0.8 }]}>van je coach of trainingsplan</Text>
            </View>
            <Text style={[styles.tileArrow, { color: p.accentInk }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tile, { backgroundColor: p.surface, borderColor: p.border }]} onPress={() => handleSourceTap('excel')}>
            <View style={styles.tileBody}>
              <Text style={[styles.tileTitle, { color: p.text }]}>Excel / sheet</Text>
              <Text style={[styles.tileSub, { color: p.muted }]}>spreadsheet of .csv</Text>
            </View>
            <Text style={[styles.tileArrow, { color: p.muted }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tile, { backgroundColor: p.surface, borderColor: p.border }]} onPress={() => handleSourceTap('foto')}>
            <View style={styles.tileBody}>
              <Text style={[styles.tileTitle, { color: p.text }]}>Foto</Text>
              <Text style={[styles.tileSub, { color: p.muted }]}>whiteboard, briefje, schermafdruk</Text>
            </View>
            <Text style={[styles.tileArrow, { color: p.muted }]}>›</Text>
          </TouchableOpacity>

          {error ? <Text style={[styles.errorText, { color: p.danger }]}>{error}</Text> : null}
        </View>
      )}

      {/* ── Frame 3: file picked ───────────────────────────────────── */}
      {step === 'picked' && (
        <View style={[styles.column, styles.centered]}>
          {/* Document preview mockup */}
          <View style={[styles.docPreview, { backgroundColor: p.surface, borderColor: p.border }]}>
            <View style={[styles.docLine, { width: '70%', backgroundColor: p.text }]} />
            <View style={[styles.docLine, { backgroundColor: p.border }]} />
            <View style={[styles.docLine, { width: '85%', backgroundColor: p.border }]} />
            <View style={[styles.docLine, { backgroundColor: p.border }]} />
            <View style={[styles.docLine, { width: '60%', backgroundColor: p.border }]} />
            <Text style={[styles.docFileName, { color: p.muted }]}>{fileName}</Text>
          </View>

          <Text style={[styles.fileNameBig, { color: p.text }]}>{fileName}</Text>
          {!fileB64 && <Text style={[styles.loadingHint, { color: p.muted }]}>bestand laden…</Text>}
          {fileB64  && <Text style={[styles.loadingHint, { color: p.accent }]}>✓ klaar om te analyseren</Text>}

          {error ? <Text style={[styles.errorText, { color: p.danger }]}>{error}</Text> : null}

          {/* Config (collapsible) */}
          <TouchableOpacity onPress={() => setShowConfig(s => !s)} style={styles.configToggle}>
            <Text style={[styles.configToggleText, { color: p.muted }]}>
              {showConfig ? '▴' : '▾'} Instellingen
            </Text>
          </TouchableOpacity>
          {showConfig && (
            <View style={[styles.configBox, { backgroundColor: p.surface, borderColor: p.border }]}>
              <Text style={[styles.configLabel, { color: p.muted }]}>Begindatum</Text>
              <TextInput style={[styles.configInput, { color: p.text, borderColor: p.border, backgroundColor: p.bg }]} value={startDate} onChangeText={setStartDate} keyboardType="numbers-and-punctuation" />
              <Text style={[styles.configLabel, { color: p.muted, marginTop: 8 }]}>Hardloopdagen</Text>
              <View style={styles.dayRow}>
                {DAY_LABELS.map((label, i) => {
                  const on = runDays.includes(i)
                  return (
                    <TouchableOpacity key={i} style={[styles.dayBtn, { backgroundColor: on ? p.accent : p.bg, borderColor: on ? p.accent : p.border }]}
                      onPress={() => setRunDays(prev => on ? prev.filter(d => d !== i) : [...prev, i].sort())}>
                      <Text style={[styles.dayBtnText, { color: on ? p.accentInk : p.muted }]}>{label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              <View style={[styles.keepRestRow, { marginTop: 8 }]}>
                <Text style={[styles.configLabel, { color: p.muted, flex: 1 }]}>Rustdagen behouden</Text>
                <Switch value={keepRest} onValueChange={setKeepRest} trackColor={{ true: p.accent }} thumbColor="#fff" />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: p.accent }, !fileB64 && { opacity: 0.45 }]}
            onPress={analyse}
            disabled={!fileB64}
          >
            <Text style={[styles.ctaBtnText, { color: p.accentInk }]}>schema analyseren →</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setStep('source')} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: p.muted }]}>← andere bron kiezen</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Frame 4: processing ───────────────────────────────────── */}
      {step === 'processing' && (
        <View style={[styles.column, styles.centered, { paddingVertical: 48 }]}>
          <CircleProgress pct={progress} size={96} color={p.accent} />
          <Text style={[styles.processingTitle, { color: p.text }]}>schema lezen…</Text>
          <Text style={[styles.processingPct, { color: p.muted }]}>{progress}%</Text>
        </View>
      )}

      {/* ── Frame 5: preview / gevonden ───────────────────────────── */}
      {step === 'preview' && (
        <View style={styles.column}>
          <Text style={[styles.gevondenTitle, { color: p.text }]}>gevonden</Text>

          {wekenStr && <InfoCard label={wekenStr} value={rapport.split('.')[0] ?? ''} p={p} />}
          {schemaTitle && <InfoCard label={schemaTitle} value={piekStr ? `piekweek ${piekStr}` : ''} p={p} />}
          {preview.filter(r => r.type === 'race').slice(0, 1).map(r => (
            <InfoCard key={r.datum} label="doelrace" value={r.datum} p={p} />
          ))}

          {rapport ? (
            <Text style={[styles.rapportText, { color: p.muted }]}>{rapport}</Text>
          ) : null}

          <Text style={[styles.countText, { color: p.muted }]}>
            {preview.length} activiteiten · {preview.reduce((s, r) => s + (r.km ?? 0), 0).toFixed(0)} km
          </Text>

          {error ? <Text style={[styles.errorText, { color: p.danger }]}>{error}</Text> : null}

          <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: p.accent }]} onPress={confirm}>
            <Text style={[styles.ctaBtnText, { color: p.accentInk }]}>klopt het? importeren →</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setStep('picked')} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: p.muted }]}>← opnieuw analyseren</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Frame 6: success ──────────────────────────────────────── */}
      {step === 'success' && (
        <View style={[styles.column, styles.centered, { paddingVertical: 48 }]}>
          <View style={[styles.successCircle, { backgroundColor: p.accent }]}>
            <Text style={styles.successCheck}>✓</Text>
          </View>
          <Text style={[styles.successTitle, { color: p.text }]}>klaar</Text>
          <Text style={[styles.successSub, { color: p.muted }]}>je schema loopt nu mee.</Text>
          <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: p.accent, marginTop: 32 }]} onPress={() => { reset(); onClose() }}>
            <Text style={[styles.ctaBtnText, { color: p.accentInk }]}>naar vandaag →</Text>
          </TouchableOpacity>
        </View>
      )}

    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  column:           { gap: Spacing.md },
  centered:         { alignItems: 'center' },

  // Source tiles
  sectionLabel:     { fontFamily: Fonts.displayMedium, fontSize: 12, letterSpacing: -0.1 },
  tile:             { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: '14px 16px' as any, paddingHorizontal: 16, paddingVertical: 14 },
  tilePrimary:      {},
  tileBody:         { flex: 1 },
  tileTitle:        { fontFamily: Fonts.displaySemiBold, fontSize: 13 },
  tileSub:          { fontFamily: Fonts.displayMedium, fontSize: 11, marginTop: 2 },
  tileArrow:        { fontFamily: Fonts.display, fontSize: 18 },

  // File picked
  docPreview:       { width: 140, borderRadius: 8, padding: 14, gap: 6, borderWidth: 1, transform: [{ rotate: '-2deg' }], shadowColor: '#0E1F1A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  docLine:          { height: 5, borderRadius: 2 },
  docFileName:      { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, marginTop: 4 },
  fileNameBig:      { fontFamily: Fonts.displaySemiBold, fontSize: 14, letterSpacing: -0.1, textAlign: 'center' },
  loadingHint:      { fontFamily: Fonts.mono, fontSize: 11 },
  errorText:        { fontFamily: Fonts.display, fontSize: 13 },
  configToggle:     { alignSelf: 'flex-start' },
  configToggleText: { fontFamily: Fonts.displayMedium, fontSize: 12 },
  configBox:        { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  configLabel:      { fontFamily: Fonts.displayMedium, fontSize: 11 },
  configInput:      { fontFamily: Fonts.mono, fontSize: 13, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  dayRow:           { flexDirection: 'row', gap: 4 },
  dayBtn:           { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  dayBtnText:       { fontFamily: Fonts.displayMedium, fontSize: 11 },
  keepRestRow:      { flexDirection: 'row', alignItems: 'center' },

  // Processing
  processingTitle:  { fontFamily: Fonts.displaySemiBold, fontSize: 14, marginTop: 16 },
  processingPct:    { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, marginTop: 4 },

  // Preview
  gevondenTitle:    { fontFamily: Fonts.displayBold, fontSize: 20, letterSpacing: -0.5 },
  infoCard:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  infoLabel:        { fontFamily: Fonts.displaySemiBold, fontSize: 12 },
  infoValue:        { fontFamily: Fonts.mono, fontSize: 10 },
  rapportText:      { fontFamily: Fonts.display, fontSize: 13, lineHeight: 20 },
  countText:        { fontFamily: Fonts.mono, fontSize: 11 },

  // CTA
  ctaBtn:           { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  ctaBtnText:       { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.2 },
  backBtn:          { alignItems: 'center', padding: Spacing.sm },
  backBtnText:      { fontFamily: Fonts.display, fontSize: 13 },

  // Success
  successCircle:    { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  successCheck:     { fontFamily: Fonts.displayBold, fontSize: 34, color: '#fff', lineHeight: 40 },
  successTitle:     { fontFamily: Fonts.displayBold, fontSize: 24, letterSpacing: -0.5, marginTop: 16 },
  successSub:       { fontFamily: Fonts.displayMedium, fontSize: 13, marginTop: 4 },
})
