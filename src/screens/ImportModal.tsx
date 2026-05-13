import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Switch, Alert,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { ModalSheet } from '@/components/shared/ModalSheet'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { createNewSheet, todaySchemaName } from '@/services/drive'
import { appendActivity, verifyOrFixHeaders, getSheetTabId, sortSheet } from '@/services/sheets'
import { LightTheme, Fonts, Spacing, Radius, ActivityColors } from '@/constants/theme'
import { TYPE_DISPLAY, ACTIVITY_TYPES } from '@/constants/activities'
import type { ActivityType } from '@/constants/activities'

const BACKEND = 'https://runyo-auth-production.up.railway.app'
const DAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

const SYSTEM_PROMPT = `Je krijgt een trainingsschema (PDF, afbeelding, Excel of tekst).

Eerste stap (kritiek): Scan naar de kern — zoek week/dag-structuren. Sla inleidingen, motivatie, algemene adviezen over.

Velden per item: datum (YYYY-MM-DD), type (run|kracht|mobiliteit|rust|herstel|werk|race), titel (max 70 tekens), detail (max 170 tekens), km (number|null), fase ("" altijd leeg).

Regels:
1. Volg exact de weken en dagen. Ontbrekende dagen → rust.
2. Begindatum = eerste dag week 1. Elke week +7 dagen.
3. REST/Off → type rust. Cross-Training → mobiliteit.
4. Meerdere sessies per dag: combineer in één item.
5. km: miles × 1.609, afronden op 1 decimaal. Ranges zonder afstand → null.
6. Output: chronologisch, één entry per dag.

Schrijf eerst TITEL: (max 30 tekens, naam van het schema).
Dan RAPPORT: (max 5 zinnen, plain language samenvatting voor de gebruiker).
Dan direct de JSON array, geen markdown, geen \`\`\`json.`

type Step = 'input' | 'config' | 'preview' | 'importing'

type ParsedRow = {
  datum: string
  type: string
  titel: string
  detail: string
  km: number | null
  fase: string
}

type InputMode = 'text' | 'file' | 'photo'

export function ImportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const getToken       = useAuthStore(s => s.getToken)
  const setSchema      = useDataStore(s => s.setSchema)
  const setActivities  = useDataStore(s => s.setActivities)
  const showToast      = useUiStore(s => s.showToast)

  const [step,       setStep]       = useState<Step>('input')
  const [inputMode,  setInputMode]  = useState<InputMode>('text')
  const [text,       setText]       = useState('')
  const [fileName,   setFileName]   = useState('')
  const [fileB64,    setFileB64]    = useState('')
  const [fileMime,   setFileMime]   = useState('')
  const [startDate,  setStartDate]  = useState(new Date().toISOString().split('T')[0])
  const [runDays,    setRunDays]    = useState([0, 2, 4])
  const [keepRest,   setKeepRest]   = useState(true)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [schemaTitle, setSchemaTitle] = useState('')
  const [rapport,    setRapport]    = useState('')
  const [preview,    setPreview]    = useState<ParsedRow[]>([])

  function reset() {
    setStep('input'); setText(''); setFileName(''); setFileB64(''); setFileMime('')
    setStartDate(new Date().toISOString().split('T')[0]); setRunDays([0, 2, 4]); setKeepRest(true)
    setLoading(false); setError(''); setSchemaTitle(''); setRapport(''); setPreview([])
    setInputMode('text')
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'text/plain'],
      copyToCacheDirectory: true,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
    setFileB64(b64)
    setFileName(asset.name)
    setFileMime(asset.mimeType ?? 'application/pdf')
    setInputMode('file')
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Toegang nodig', 'Sta toegang tot foto\'s toe in instellingen.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setFileB64(asset.base64 ?? '')
    setFileName('foto.jpg')
    setFileMime('image/jpeg')
    setInputMode('photo')
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) { Alert.alert('Toegang nodig', 'Sta cameratoegang toe in instellingen.'); return }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setFileB64(asset.base64 ?? '')
    setFileName('foto.jpg')
    setFileMime('image/jpeg')
    setInputMode('photo')
  }

  function canProceedToConfig() {
    return inputMode === 'text' ? text.trim().length > 20 : !!fileB64
  }

  async function runAI() {
    setLoading(true)
    setError('')
    const dayNames = DAY_LABELS.filter((_, i) => runDays.includes(i)).join(', ')
    const userText = `Begindatum: ${startDate}. Hardloopdagen: ${dayNames}. Rustdagen behouden: ${keepRest ? 'ja' : 'nee'}.`

    let userContent: unknown
    if (inputMode === 'text') {
      userContent = `${userText}\n\n${text}`
    } else if (fileMime === 'image/jpeg' || fileMime === 'image/png') {
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

    try {
      const token = await getToken()
      const res = await fetch(`${BACKEND}/ai/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        }),
      })
      if (!res.ok) throw new Error(`API fout ${res.status}`)
      const json = await res.json() as { content: { text: string }[] }
      const raw = json.content?.[0]?.text ?? ''

      const titelMatch = raw.match(/TITEL\s*:\s*([^\n\r]{1,40})/i)
      setSchemaTitle(titelMatch?.[1]?.trim() ?? '')
      const rapportMatch = raw.match(/RAPPORT\s*:\s*([\s\S]*?)(?=\[|$)/i)
      setRapport(rapportMatch?.[1]?.trim() ?? '')

      let parsed: ParsedRow[] | null = null
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      const cleaned = fenced ? fenced[1].trim() : raw.trim()
      const m = cleaned.match(/\[[\s\S]*\]/) ?? raw.match(/\[[\s\S]*\]/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch {} }

      if (!Array.isArray(parsed) || !parsed.length) throw new Error('Geen schema gevonden. Probeer meer details toe te voegen.')

      const rows = parsed
        .filter(r => r?.datum && /^\d{4}-\d{2}-\d{2}$/.test(r.datum))
        .map(r => ({
          datum: r.datum,
          type: r.type || 'run',
          titel: String(r.titel || ''),
          detail: String(r.detail || ''),
          km: r.km != null && r.km !== '' ? Number(r.km) || null : null,
          fase: r.fase || '',
        }))

      if (!rows.length) throw new Error('Geen activiteiten gevonden in de output.')
      setPreview(rows)
      setStep('preview')
    } catch (e: any) {
      setError(e.message ?? 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }

  async function confirmImport() {
    setStep('importing')
    const token = await getToken()
    if (!token) { setError('Niet ingelogd'); setStep('preview'); return }
    try {
      const d = new Date()
      const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
      const titlePart = schemaTitle ? `${schemaTitle} ` : ''
      const baseName = `runyo schema ${titlePart}${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
      const entry = await createNewSheet(token, baseName)
      await verifyOrFixHeaders(entry.id, 'Schema', token)

      for (const row of preview) {
        await appendActivity(entry.id, 'Schema', token, {
          datum: row.datum, type: row.type as ActivityType,
          titel: row.titel, detail: row.detail,
          km: row.km, feedback: null, fase: row.fase, raceType: null,
        })
      }

      const tabId = await getSheetTabId(entry.id, 'Schema', token).catch(() => 0)
      if (tabId) await sortSheet(entry.id, tabId, token).catch(() => {})

      await setSchema(entry.id, 'Schema', entry.name, tabId)
      showToast(`✓ ${preview.length} activiteiten geïmporteerd`)
      reset()
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Importeren mislukt')
      setStep('preview')
    }
  }

  // ── Week preview visualization ──────────────────────────────────────────

  function renderWeekBars() {
    const byWeek: Record<number, ParsedRow[]> = {}
    const base = new Date(preview[0]?.datum ?? startDate)
    preview.forEach(r => {
      const d = new Date(r.datum)
      const w = Math.floor((d.getTime() - base.getTime()) / (7 * 86400000))
      if (!byWeek[w]) byWeek[w] = []
      byWeek[w].push(r)
    })
    return Object.entries(byWeek).slice(0, 8).map(([wk, rows]) => {
      const km = rows.reduce((s, r) => s + (r.km ?? 0), 0)
      const types = [...new Set(rows.map(r => r.type))]
      return (
        <View key={wk} style={wbStyles.row}>
          <Text style={wbStyles.label}>WK {parseInt(wk) + 1}</Text>
          <View style={wbStyles.dots}>
            {types.map(t => {
              const c = ActivityColors[t as ActivityType]?.text ?? LightTheme.accent
              return <View key={t} style={[wbStyles.dot, { backgroundColor: c }]} />
            })}
          </View>
          <Text style={wbStyles.km}>{km > 0 ? `${km.toFixed(0)} km` : ''}</Text>
        </View>
      )
    })
  }

  const stepTitle = { input: 'Importeer schema', config: 'Instellen', preview: 'Voorbeeld', importing: 'Importeren…' }[step]

  return (
    <ModalSheet visible={visible} title={stepTitle} onClose={() => { reset(); onClose() }}>

      {/* ── Step 1: Input ─────────────────────────────────────────────── */}
      {step === 'input' && (
        <View style={styles.container}>
          {/* Input mode tabs */}
          <View style={styles.modeTabs}>
            {(['text', 'file', 'photo'] as InputMode[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.modeTab, inputMode === m && styles.modeTabActive]}
                onPress={() => { setInputMode(m); if (m !== 'text') m === 'file' ? pickDocument() : pickPhoto() }}
              >
                <Text style={[styles.modeTabText, inputMode === m && styles.modeTabTextActive]}>
                  {m === 'text' ? '📝 Tekst' : m === 'file' ? '📄 Bestand' : '📷 Foto'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {inputMode === 'text' && (
            <TextInput
              style={styles.textarea}
              value={text}
              onChangeText={setText}
              placeholder="Plak hier je trainingsschema als tekst, of beschrijf je schema…"
              placeholderTextColor={LightTheme.faint}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
          )}

          {inputMode === 'file' && (
            <View style={styles.fileInfo}>
              <Text style={styles.fileInfoName}>{fileName || 'Geen bestand geselecteerd'}</Text>
              <TouchableOpacity style={styles.rePickBtn} onPress={pickDocument}>
                <Text style={styles.rePickText}>Ander bestand</Text>
              </TouchableOpacity>
            </View>
          )}

          {inputMode === 'photo' && (
            <View style={styles.fileInfo}>
              <Text style={styles.fileInfoName}>{fileName ? 'Foto geselecteerd ✓' : 'Geen foto geselecteerd'}</Text>
              <View style={styles.photoRow}>
                <TouchableOpacity style={styles.rePickBtn} onPress={pickPhoto}>
                  <Text style={styles.rePickText}>Galerij</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rePickBtn} onPress={takePhoto}>
                  <Text style={styles.rePickText}>Camera</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, !canProceedToConfig() && styles.primaryBtnDisabled]}
            onPress={() => setStep('config')}
            disabled={!canProceedToConfig()}
          >
            <Text style={styles.primaryBtnText}>Volgende →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Step 2: Config ────────────────────────────────────────────── */}
      {step === 'config' && (
        <View style={styles.container}>
          <Text style={styles.sectionLabel}>Begindatum</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={LightTheme.faint}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.sectionLabel}>Hardloopdagen</Text>
          <View style={styles.dayGrid}>
            {DAY_LABELS.map((label, i) => {
              const active = runDays.includes(i)
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.dayBtn, active && styles.dayBtnActive]}
                  onPress={() => setRunDays(prev => active ? prev.filter(d => d !== i) : [...prev, i].sort())}
                >
                  <Text style={[styles.dayBtnText, active && styles.dayBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Rustdagen behouden</Text>
              <Text style={styles.toggleSub}>Vervang rust niet door extra training</Text>
            </View>
            <Switch value={keepRest} onValueChange={setKeepRest} trackColor={{ true: LightTheme.accent }} thumbColor="#fff" />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={LightTheme.accent} />
              <Text style={styles.loadingText}>Schema analyseren…</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} onPress={runAI}>
              <Text style={styles.primaryBtnText}>Schema importeren →</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.backBtn} onPress={() => setStep('input')}>
            <Text style={styles.backBtnText}>← Terug</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Step 3: Preview ───────────────────────────────────────────── */}
      {step === 'preview' && (
        <View style={styles.container}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewCheck}>✓ Schema herkend</Text>
            {schemaTitle ? <Text style={styles.previewTitle}>{schemaTitle}</Text> : null}
            <Text style={styles.previewMeta}>
              {preview.length} activiteiten · {preview.reduce((s, r) => s + (r.km ?? 0), 0).toFixed(0)} km totaal
            </Text>
          </View>

          {rapport ? (
            <View style={styles.rapportBox}>
              <Text style={styles.rapportText}>{rapport}</Text>
            </View>
          ) : null}

          <View style={styles.weekBars}>{renderWeekBars()}</View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.primaryBtn} onPress={confirmImport}>
            <Text style={styles.primaryBtnText}>Klopt, ga verder →</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backBtn} onPress={() => setStep('config')}>
            <Text style={styles.backBtnText}>← Terug</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Importing ─────────────────────────────────────────────────── */}
      {step === 'importing' && (
        <View style={[styles.container, styles.centeredRow]}>
          <ActivityIndicator color={LightTheme.accent} size="large" />
          <Text style={styles.loadingText}>Schema aanmaken en rijen wegschrijven…</Text>
        </View>
      )}

    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  container:          { gap: Spacing.md },
  centeredRow:        { alignItems: 'center', paddingTop: Spacing.xxl },
  modeTabs:           { flexDirection: 'row', gap: Spacing.sm },
  modeTab:            { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: LightTheme.surface, borderWidth: 1, borderColor: LightTheme.border, alignItems: 'center' },
  modeTabActive:      { borderColor: LightTheme.accent, backgroundColor: LightTheme.accentGlow },
  modeTabText:        { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.muted },
  modeTabTextActive:  { color: LightTheme.accent },
  textarea:           { fontFamily: Fonts.display, fontSize: 13, color: LightTheme.text, backgroundColor: LightTheme.surface, borderRadius: Radius.md, padding: Spacing.md, minHeight: 160, borderWidth: 1, borderColor: LightTheme.border, textAlignVertical: 'top' },
  fileInfo:           { backgroundColor: LightTheme.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: LightTheme.border, gap: Spacing.sm },
  fileInfoName:       { fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text },
  photoRow:           { flexDirection: 'row', gap: Spacing.sm },
  rePickBtn:          { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.sm, borderWidth: 1, borderColor: LightTheme.border, alignSelf: 'flex-start' },
  rePickText:         { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.muted },
  sectionLabel:       { fontFamily: Fonts.displaySemiBold, fontSize: 12, color: LightTheme.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  input:              { fontFamily: Fonts.mono, fontSize: 14, color: LightTheme.text, backgroundColor: LightTheme.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: LightTheme.border },
  dayGrid:            { flexDirection: 'row', gap: Spacing.sm },
  dayBtn:             { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm, backgroundColor: LightTheme.surface, borderWidth: 1, borderColor: LightTheme.border, alignItems: 'center' },
  dayBtnActive:       { backgroundColor: LightTheme.accent, borderColor: LightTheme.accent },
  dayBtnText:         { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.muted },
  dayBtnTextActive:   { color: '#fff' },
  toggleRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel:        { fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text },
  toggleSub:          { fontFamily: Fonts.display, fontSize: 11, color: LightTheme.muted, marginTop: 2 },
  loadingRow:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, justifyContent: 'center' },
  loadingText:        { fontFamily: Fonts.display, fontSize: 13, color: LightTheme.muted },
  errorText:          { fontFamily: Fonts.display, fontSize: 13, color: '#C8336B', lineHeight: 18 },
  previewHeader:      { gap: 4 },
  previewCheck:       { fontFamily: Fonts.displaySemiBold, fontSize: 13, color: LightTheme.accent },
  previewTitle:       { fontFamily: Fonts.displayBold, fontSize: 20, color: LightTheme.text, letterSpacing: -0.3 },
  previewMeta:        { fontFamily: Fonts.mono, fontSize: 12, color: LightTheme.muted },
  rapportBox:         { backgroundColor: LightTheme.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: LightTheme.border },
  rapportText:        { fontFamily: Fonts.display, fontSize: 13, color: LightTheme.text, lineHeight: 20 },
  weekBars:           { gap: 4 },
  primaryBtn:         { backgroundColor: LightTheme.accent, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText:     { fontFamily: Fonts.displaySemiBold, fontSize: 15, color: '#fff' },
  backBtn:            { alignItems: 'center', padding: Spacing.sm },
  backBtnText:        { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.muted },
})

const wbStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 2 },
  label: { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted, width: 36 },
  dots:  { flexDirection: 'row', gap: 3, flex: 1 },
  dot:   { width: 8, height: 8, borderRadius: 4 },
  km:    { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted, width: 44, textAlign: 'right' },
})
