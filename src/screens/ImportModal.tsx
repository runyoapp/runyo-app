import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, Switch,
} from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { useQueryClient } from '@tanstack/react-query'
import { ModalSheet } from '@/components/shared/ModalSheet'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { pickFile, pickPhoto, analyseSchema, analyseSchemaFromUrl, importToBackend } from '@/services/import'
import type { ParsedRow, AnalyseResult } from '@/services/import'
import { Fonts, Spacing, Radius } from '@/constants/theme'

const DAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

type Step = 'source' | 'excel-choice' | 'url-input' | 'picked' | 'processing' | 'preview' | 'success'
type Source = 'pdf' | 'excel' | 'foto' | 'url'

function CircleProgress({ pct, size = 80, color }: { pct: number; size: number; color: string }) {
  const r    = (size - 12) / 2
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

function InfoCard({ label, value, p }: { label: string; value: string; p: any }) {
  return (
    <View style={[styles.infoCard, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Text style={[styles.infoLabel, { color: p.text }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: p.muted }]}>{value}</Text>
    </View>
  )
}

export function ImportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const p              = useTheme()
  const getToken       = useAuthStore(s => s.getToken)
  const activateImport = useDataStore(s => s.activateImport)
  const queryClient    = useQueryClient()

  const [step,        setStep]        = useState<Step>('source')
  const [source,      setSource]      = useState<Source>('pdf')
  const [fileName,    setFileName]    = useState('')
  const [fileB64,     setFileB64]     = useState('')
  const [fileMime,    setFileMime]    = useState('')
  const [urlInput,    setUrlInput]    = useState('')
  const [progress,    setProgress]    = useState(0)
  const [result,      setResult]      = useState<AnalyseResult | null>(null)
  const [error,       setError]       = useState('')
  const [startDate,   setStartDate]   = useState(new Date().toISOString().split('T')[0])
  const [runDays,     setRunDays]     = useState([0, 2, 4])
  const [keepRest,    setKeepRest]    = useState(true)
  const [showConfig,  setShowConfig]  = useState(false)

  function reset() {
    setStep('source'); setSource('pdf'); setFileName(''); setFileB64(''); setFileMime('')
    setUrlInput(''); setProgress(0); setResult(null); setError(''); setShowConfig(false)
    setStartDate(new Date().toISOString().split('T')[0])
    setRunDays([0, 2, 4]); setKeepRest(true)
  }

  async function handleFileTap(src: 'pdf' | 'excel' | 'foto') {
    try {
      const picked = src === 'foto' ? await pickPhoto(false) : await pickFile()
      if (!picked) return
      setSource(src)
      setFileName(picked.fileName)
      setFileMime(picked.fileMime)
      setFileB64(picked.fileB64)
      setStep('picked')
    } catch (e: any) {
      setError(`Bestand laden mislukt: ${e?.message ?? ''}`)
    }
  }

  function handleUrlConfirm() {
    if (!urlInput.trim()) { setError('Vul een URL in.'); return }
    setSource('url')
    setFileName(urlInput.trim())
    setStep('picked')
    setError('')
  }

  async function analyse() {
    setStep('processing'); setProgress(0); setError('')
    try {
      let analysed: AnalyseResult
      if (source === 'url') {
        analysed = await analyseSchemaFromUrl(urlInput.trim(), startDate, runDays, keepRest, getToken, setProgress)
      } else {
        if (!fileB64) { setError('Wacht tot het bestand geladen is.'); setStep('picked'); return }
        analysed = await analyseSchema(fileB64, fileMime, startDate, runDays, keepRest, getToken, setProgress)
      }
      setResult(analysed)
      setProgress(100)
      setStep('preview')
    } catch (e: any) {
      setError(e.message ?? 'Analyse mislukt'); setStep('picked')
    }
  }

  async function confirm() {
    if (!result) return
    setStep('processing'); setProgress(0)
    try {
      const { schemaId, activities } = await importToBackend(result.rows, getToken, setProgress)
      await activateImport(schemaId)
      queryClient.setQueryData(['activities', 'backend', schemaId], activities)
      setStep('success')
    } catch (e: any) {
      setError(e.message ?? 'Importeren mislukt'); setStep('preview')
    }
  }

  const preview: ParsedRow[] = result?.rows ?? []

  return (
    <ModalSheet visible={visible} title="Schema laden" onClose={() => { reset(); onClose() }}>

      {step === 'source' && (
        <View style={styles.column}>
          <Text style={[styles.sectionLabel, { color: p.muted }]}>kies je bron</Text>

          <TouchableOpacity style={[styles.tile, styles.tilePrimary, { backgroundColor: p.accent, borderColor: p.accent }]} onPress={() => handleFileTap('pdf')}>
            <View style={styles.tileBody}>
              <Text style={[styles.tileTitle, { color: p.accentInk }]}>PDF</Text>
              <Text style={[styles.tileSub, { color: p.accentInk, opacity: 0.8 }]}>van je coach of trainingsplan</Text>
            </View>
            <Text style={[styles.tileArrow, { color: p.accentInk }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tile, { backgroundColor: p.surface, borderColor: p.border }]} onPress={() => setStep('excel-choice')}>
            <View style={styles.tileBody}>
              <Text style={[styles.tileTitle, { color: p.text }]}>Excel / sheet</Text>
              <Text style={[styles.tileSub, { color: p.muted }]}>spreadsheet, .csv of link</Text>
            </View>
            <Text style={[styles.tileArrow, { color: p.muted }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tile, { backgroundColor: p.surface, borderColor: p.border }]} onPress={() => handleFileTap('foto')}>
            <View style={styles.tileBody}>
              <Text style={[styles.tileTitle, { color: p.text }]}>Foto</Text>
              <Text style={[styles.tileSub, { color: p.muted }]}>whiteboard, briefje, schermafdruk</Text>
            </View>
            <Text style={[styles.tileArrow, { color: p.muted }]}>›</Text>
          </TouchableOpacity>

          {error ? <Text style={[styles.errorText, { color: p.danger }]}>{error}</Text> : null}
        </View>
      )}

      {step === 'excel-choice' && (
        <View style={styles.column}>
          <Text style={[styles.sectionLabel, { color: p.muted }]}>Excel / sheet</Text>

          <TouchableOpacity style={[styles.tile, { backgroundColor: p.surface, borderColor: p.border }]} onPress={() => handleFileTap('excel')}>
            <View style={styles.tileBody}>
              <Text style={[styles.tileTitle, { color: p.text }]}>Bestand kiezen</Text>
              <Text style={[styles.tileSub, { color: p.muted }]}>.xlsx of .csv van je apparaat</Text>
            </View>
            <Text style={[styles.tileArrow, { color: p.muted }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tile, { backgroundColor: p.surface, borderColor: p.border }]} onPress={() => setStep('url-input')}>
            <View style={styles.tileBody}>
              <Text style={[styles.tileTitle, { color: p.text }]}>Link invullen</Text>
              <Text style={[styles.tileSub, { color: p.muted }]}>Google Sheets of andere URL</Text>
            </View>
            <Text style={[styles.tileArrow, { color: p.muted }]}>›</Text>
          </TouchableOpacity>

          {error ? <Text style={[styles.errorText, { color: p.danger }]}>{error}</Text> : null}

          <TouchableOpacity onPress={() => setStep('source')} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: p.muted }]}>← terug</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'url-input' && (
        <View style={[styles.column, styles.centered]}>
          <Text style={[styles.sectionLabel, { color: p.muted }]}>plak de URL van je schema</Text>

          <TextInput
            style={[styles.urlInput, { color: p.text, borderColor: p.border, backgroundColor: p.surface }]}
            value={urlInput}
            onChangeText={v => { setUrlInput(v); setError('') }}
            placeholder="https://docs.google.com/spreadsheets/…"
            placeholderTextColor={p.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          {error ? <Text style={[styles.errorText, { color: p.danger }]}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: p.accent }, !urlInput.trim() && { opacity: 0.45 }]}
            onPress={handleUrlConfirm}
            disabled={!urlInput.trim()}
          >
            <Text style={[styles.ctaBtnText, { color: p.accentInk }]}>doorgaan →</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setStep('excel-choice')} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: p.muted }]}>← terug</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'picked' && (
        <View style={[styles.column, styles.centered]}>
          <View style={[styles.docPreview, { backgroundColor: p.surface, borderColor: p.border }]}>
            <View style={[styles.docLine, { width: '70%', backgroundColor: p.text }]} />
            <View style={[styles.docLine, { backgroundColor: p.border }]} />
            <View style={[styles.docLine, { width: '85%', backgroundColor: p.border }]} />
            <View style={[styles.docLine, { backgroundColor: p.border }]} />
            <View style={[styles.docLine, { width: '60%', backgroundColor: p.border }]} />
            <Text style={[styles.docFileName, { color: p.muted }]}>{fileName}</Text>
          </View>

          <Text style={[styles.fileNameBig, { color: p.text }]} numberOfLines={2}>{fileName}</Text>
          {source !== 'url' && !fileB64 && <Text style={[styles.loadingHint, { color: p.muted }]}>bestand laden…</Text>}
          {(source === 'url' || fileB64) && <Text style={[styles.loadingHint, { color: p.accent }]}>✓ klaar om te analyseren</Text>}

          {error ? <Text style={[styles.errorText, { color: p.danger }]}>{error}</Text> : null}

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
            style={[styles.ctaBtn, { backgroundColor: p.accent }, (source !== 'url' && !fileB64) && { opacity: 0.45 }]}
            onPress={analyse}
            disabled={source !== 'url' && !fileB64}
          >
            <Text style={[styles.ctaBtnText, { color: p.accentInk }]}>schema analyseren →</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setStep(source === 'url' ? 'url-input' : source === 'excel' ? 'excel-choice' : 'source')} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: p.muted }]}>← andere bron kiezen</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'processing' && (
        <View style={[styles.column, styles.centered, { paddingVertical: 48 }]}>
          <CircleProgress pct={progress} size={96} color={p.accent} />
          <Text style={[styles.processingTitle, { color: p.text }]}>schema lezen…</Text>
          <Text style={[styles.processingPct, { color: p.muted }]}>{progress}%</Text>
        </View>
      )}

      {step === 'preview' && result && (
        <View style={styles.column}>
          <Text style={[styles.gevondenTitle, { color: p.text }]}>gevonden</Text>

          {result.wekenStr  && <InfoCard label={result.wekenStr} value={result.rapport.split('.')[0] ?? ''} p={p} />}
          {result.schemaTitle && <InfoCard label={result.schemaTitle} value={result.piekStr ? `piekweek ${result.piekStr}` : ''} p={p} />}
          {preview.filter(r => r.type === 'race').slice(0, 1).map(r => (
            <InfoCard key={r.datum} label="doelrace" value={r.datum} p={p} />
          ))}

          {result.rapport ? (
            <Text style={[styles.rapportText, { color: p.muted }]}>{result.rapport}</Text>
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
  sectionLabel:     { fontFamily: Fonts.displayMedium, fontSize: 12, letterSpacing: -0.1 },
  tile:             { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  tilePrimary:      {},
  tileBody:         { flex: 1 },
  tileTitle:        { fontFamily: Fonts.displaySemiBold, fontSize: 13 },
  tileSub:          { fontFamily: Fonts.displayMedium, fontSize: 11, marginTop: 2 },
  tileArrow:        { fontFamily: Fonts.display, fontSize: 18 },
  urlInput:         { width: '100%', fontFamily: Fonts.mono, fontSize: 12, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10 },
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
  processingTitle:  { fontFamily: Fonts.displaySemiBold, fontSize: 14, marginTop: 16 },
  processingPct:    { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, marginTop: 4 },
  gevondenTitle:    { fontFamily: Fonts.displayBold, fontSize: 20, letterSpacing: -0.5 },
  infoCard:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  infoLabel:        { fontFamily: Fonts.displaySemiBold, fontSize: 12 },
  infoValue:        { fontFamily: Fonts.mono, fontSize: 10 },
  rapportText:      { fontFamily: Fonts.display, fontSize: 13, lineHeight: 20 },
  countText:        { fontFamily: Fonts.mono, fontSize: 11 },
  ctaBtn:           { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  ctaBtnText:       { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.2 },
  backBtn:          { alignItems: 'center', padding: Spacing.sm },
  backBtnText:      { fontFamily: Fonts.display, fontSize: 13 },
  successCircle:    { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  successCheck:     { fontFamily: Fonts.displayBold, fontSize: 34, color: '#fff', lineHeight: 40 },
  successTitle:     { fontFamily: Fonts.displayBold, fontSize: 24, letterSpacing: -0.5, marginTop: 16 },
  successSub:       { fontFamily: Fonts.displayMedium, fontSize: 13, marginTop: 4 },
})
