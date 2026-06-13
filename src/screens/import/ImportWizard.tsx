// runyo — full-screen import-wizard (Runna-stijl). Vervangt ImportModal.
// Eén stap per scherm, 4 fasen, gepinde mint-CTA, afbreek-sheet.

import { useRef, useState, useCallback } from 'react'
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { Fonts } from '@/constants/theme'
import {
  pickFile, pickPhoto, analyseSchema, analyseSchemaFromUrl, importToBackend,
  checkFileSize, base64Bytes,
} from '@/services/import'
import type { DayMode } from '@/services/import'
import { listActivities } from '@/services/activities'
import {
  WizardTopBar, StepHead, ChoiceTile, PinnedCTA, HintRow, MailHint,
  FileRow, ModeOption, DaySelector,
} from './components/atoms'
import { WeekStartPicker } from './components/WeekStartPicker'
import { Ring, WeekGroup, ReviewSummary, ReviewLegend } from './components/review'
import { AbortSheet } from './components/AbortSheet'
import { useImportFlow } from './useImportFlow'
import { buildReviewWeeks, reviewTotals, nextTraining, overlapCount } from './reviewModel'
import { fromDateString, DAYS_NL, MONTHS_NL } from '@/utils/date'

const DAY_INDEX_TO_MASK = [0, 1, 2, 3, 4, 5, 6] // 0=ma … 6=zo

function analyzePhase(pct: number): string {
  if (pct < 0.2) return 'Schema lezen…'
  if (pct < 0.45) return 'Activiteiten tellen…'
  if (pct < 0.7) return 'Planning verwerken…'
  if (pct < 0.9) return 'Weken indelen…'
  return 'Bijna klaar…'
}

function friendlyDate(iso: string): string {
  const d = fromDateString(iso)
  if (isNaN(d.getTime())) return iso
  return `${DAYS_NL[(d.getDay() + 6) % 7].toLowerCase()} ${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${d.getFullYear()}`
}

export function ImportWizard({
  visible, onClose, onSuccess,
}: {
  visible: boolean; onClose: () => void; onSuccess?: () => void
}) {
  const t = useTheme()
  const getToken = useAuthStore(s => s.getToken)
  const activateImport = useDataStore(s => s.activateImport)
  const activeSchemaId = useDataStore(s => s.schemaId)
  const queryClient = useQueryClient()
  const flow = useImportFlow()
  const { data } = flow

  const [chooseDays, setChooseDays] = useState<boolean[]>([true, false, true, false, true, false, true])
  const [overlap, setOverlap] = useState(0)
  const analyzeRun = useRef(0)

  const close = useCallback(() => { flow.restart(); onClose() }, [flow, onClose])
  const finish = useCallback(() => { flow.restart(); (onSuccess ?? onClose)() }, [flow, onSuccess, onClose])

  // ── Bron kiezen ───────────────────────────────────────────────────────────
  async function pickSourceFile(source: 'pdf' | 'excel') {
    try {
      const picked = await pickFile()
      if (!picked) return
      flow.patch({ source, fileName: picked.fileName, fileMime: picked.fileMime, fileB64: picked.fileB64, error: '' })
      flow.go('confirm')
    } catch (e) {
      flow.patch({ error: `Bestand laden mislukt: ${(e as Error)?.message ?? ''}` })
    }
  }
  async function pickSourcePhoto() {
    try {
      const picked = await pickPhoto(false)
      if (!picked) return
      flow.patch({ source: 'photo', fileName: picked.fileName, fileMime: picked.fileMime, fileB64: picked.fileB64, error: '' })
      flow.go('confirm')
    } catch (e) {
      flow.patch({ error: `Foto laden mislukt: ${(e as Error)?.message ?? ''}` })
    }
  }

  // ── Analyse ────────────────────────────────────────────────────────────────
  async function runAnalyze() {
    const runId = ++analyzeRun.current
    flow.setAPct(0); flow.setShowCancel(false)
    flow.goAnalyze()
    // Annuleren pas na 3 min tonen: analyses kunnen legitiem enkele minuten duren,
    // en wie te vroeg een knop ziet, drukt erop en moet opnieuw wachten.
    const cancelTimer = setTimeout(() => { if (analyzeRun.current === runId) flow.setShowCancel(true) }, 180_000)
    const onProg = (pct: number) => { if (analyzeRun.current === runId) flow.setAPct(pct / 100) }
    try {
      const analysed = data.source === 'sheet'
        ? await analyseSchemaFromUrl(data.link.trim(), data.startDate, data.dayMode, getToken, onProg)
        : await analyseSchema(data.fileB64, data.fileMime, data.fileName, data.startDate, data.dayMode, getToken, onProg)
      if (analyzeRun.current !== runId) return // geannuleerd
      flow.patch({ result: analysed, error: '' })
      flow.setAPct(1)
      flow.replace('review')
    } catch (e) {
      if (analyzeRun.current !== runId) return
      const msg = (e as Error)?.message ?? ''
      if (/geen schema gevonden/i.test(msg)) { flow.replace('empty') }
      else { flow.patch({ error: msg || 'Analyse mislukt' }); flow.replace('analyzeError') }
    } finally {
      clearTimeout(cancelTimer)
    }
  }

  function cancelAnalyze() {
    analyzeRun.current++ // negeer een lopende analyse
    flow.jumpBackTo('trainingDays')
  }

  // ── Opslaan ──────────────────────────────────────────────────────────────
  async function runSave() {
    const rows = data.result?.rows ?? []
    if (!rows.length) return
    // Overlap met het huidige actieve schema (informatief, vóór de import).
    try {
      if (activeSchemaId) {
        const existing = await listActivities(activeSchemaId)
        setOverlap(overlapCount(rows, new Set(existing.map(a => a.datum))))
      } else setOverlap(0)
    } catch { setOverlap(0) }

    flow.setSavedCount(0)
    flow.go('saving')
    try {
      const { schemaId, activities } = await importToBackend(
        rows, getToken,
        pct => flow.setSavedCount(Math.round((pct / 100) * rows.length)),
        data.result?.schemaTitle || undefined,
      )
      await activateImport(schemaId, data.result?.schemaTitle || 'Geïmporteerd schema')
      queryClient.setQueryData(['activities', 'backend', schemaId], activities)
      flow.go('done')
    } catch (e) {
      flow.patch({ error: (e as Error)?.message ?? 'Importeren mislukt' })
      flow.jumpBackTo('review')
    }
  }

  function applyDayMode(choose: boolean) {
    const dayMode: DayMode = choose
      ? { mode: 'choose', days: chooseDays.map((on, i) => (on ? DAY_INDEX_TO_MASK[i] : -1)).filter(i => i >= 0) }
      : { mode: 'keep' }
    flow.setDayMode(dayMode)
  }

  const { step } = flow
  const sizeCheck = data.fileB64 && data.source !== 'sheet'
    ? checkFileSize(data.fileMime, base64Bytes(data.fileB64))
    : { level: 'ok' as const, message: '' }

  // ── Step bodies ────────────────────────────────────────────────────────────
  function renderBody() {
    switch (step) {
      case 'source':
        return (
          <View style={s.fill}>
            <StepHead t={t} title="Importeer je trainingsschema" sub="runyo leest je bestand en zet het om naar je weekschema in de app." />
            <View style={s.tileList}>
              <ChoiceTile t={t} icon="pdf" primary title="PDF" sub="Van je coach of trainingsplan" onPress={() => pickSourceFile('pdf')} />
              <ChoiceTile t={t} icon="sheet" title="Excel / sheet" sub="Spreadsheet, .csv of Google Sheet" onPress={() => flow.go('excelChoice')} />
              <ChoiceTile t={t} icon="photo" title="Foto" sub="Whiteboard, briefje of schermafdruk" onPress={pickSourcePhoto} />
            </View>
            <View style={s.flex1} />
            <View style={s.padH20}>
              <HintRow t={t}>Je bestand wordt alleen gebruikt om je schema te lezen - daarna kun je het altijd zelf bijschaven.</HintRow>
            </View>
            {data.error ? <Text style={[s.err, { color: t.danger }]}>{data.error}</Text> : null}
          </View>
        )
      case 'excelChoice':
        return (
          <View style={s.fill}>
            <StepHead t={t} title="Excel / sheet" sub="Kies een bestand van je apparaat, of plak een openbare Google Sheet-link." />
            <View style={s.tileList}>
              <ChoiceTile t={t} icon="file" title="Bestand kiezen" sub=".xlsx of .csv van je apparaat" onPress={() => pickSourceFile('excel')} />
              <ChoiceTile t={t} icon="link" title="Google Sheet-link" sub="Alléén een Google Sheet - geen Excel-url of andere online sheet" onPress={() => { flow.patch({ source: 'sheet' }); flow.go('sheetLink') }} />
            </View>
            <View style={s.flex1} />
          </View>
        )
      case 'sheetLink':
        return (
          <View style={s.fill}>
            <StepHead t={t} title="Plak je Google Sheet-link" />
            <View style={[s.padH20, { paddingTop: 20 }]}>
              <TextInput
                value={data.link}
                onChangeText={v => flow.patch({ link: v })}
                placeholder="https://docs.google.com/spreadsheets/…"
                placeholderTextColor={t.muted}
                autoCapitalize="none" autoCorrect={false} keyboardType="url"
                style={[s.linkInput, { backgroundColor: t.surface, borderColor: data.link ? t.accent : t.border, color: t.text }]}
              />
              <View style={{ marginTop: 16, gap: 12 }}>
                <HintRow t={t}>Het moet een <Text style={s.bold}>Google Sheet</Text> zijn - geen Excel-bestand of andere online sheet.</HintRow>
                <HintRow t={t}>Zet de sheet op <Text style={s.bold}>"iedereen met de link kan bekijken"</Text>, anders kan runyo er niet bij.</HintRow>
              </View>
            </View>
            <View style={s.flex1} />
          </View>
        )
      case 'confirm': {
        const icon = data.source === 'photo' ? 'photo' : data.source === 'excel' ? 'sheet' : 'pdf'
        const tone = sizeCheck.level === 'block' ? 'error' : sizeCheck.level === 'warn' ? 'warn' : 'ok'
        const statusBase = sizeCheck.level === 'block' ? 'Te groot' : sizeCheck.level === 'warn' ? 'Groot bestand' : 'Klaar'
        const sizeMB = (base64Bytes(data.fileB64) / (1024 * 1024)).toFixed(1)
        const statusTxt = `${statusBase} · ${sizeMB} MB`
        return (
          <View style={s.fill}>
            <StepHead t={t} title="Controleer je bestand" sub="Dit is het bestand dat runyo gaat analyseren." />
            <View style={[s.padH20, { paddingTop: 22, gap: 14 }]}>
              <FileRow t={t} icon={icon} name={data.fileName || 'bestand'} status={statusTxt} statusTone={tone} />
              {sizeCheck.message ? <HintRow t={t} tone={sizeCheck.level === 'block' ? 'error' : 'warn'}>{sizeCheck.message}</HintRow> : null}
              {sizeCheck.level === 'block' ? <MailHint t={t} /> : null}
            </View>
            <View style={s.flex1} />
          </View>
        )
      }
      case 'startDate':
        return (
          <ScrollView style={s.fill} contentContainerStyle={{ paddingBottom: 16 }}>
            <StepHead t={t} title="In welke week begint je schema?" sub="Kies een dag in de beginweek. runyo laat week 1 op de maandag van die week starten en rolt vanaf daar alle weken vooruit." />
            <View style={[s.padH20, { paddingTop: 20 }]}>
              <WeekStartPicker value={data.startDate} onChange={v => flow.patch({ startDate: v })} t={t} />
              <View style={{ marginTop: 16 }}>
                <HintRow t={t}>Tik op een dag en runyo kiest automatisch de maandag van die week - zo blijven alle weken netjes op elkaar aansluiten.</HintRow>
              </View>
            </View>
          </ScrollView>
        )
      case 'trainingDays': {
        const choose = data.dayMode.mode === 'choose'
        const count = chooseDays.filter(Boolean).length
        return (
          <ScrollView style={s.fill} contentContainerStyle={{ paddingBottom: 16 }}>
            <StepHead t={t} title="Wanneer wil je trainen?" sub="Heeft je schema vaste weekdagen, of bepaal jij ze zelf?" />
            <View style={[s.padH20, { paddingTop: 20, gap: 11 }]}>
              <ModeOption t={t} selected={!choose} onPress={() => applyDayMode(false)}
                title="Houd de dagen uit mijn schema aan"
                sub="Voor schema's met echte weekdagen. runyo laat de indeling intact - alleen je startdatum bepaalt week 1." />
              <ModeOption t={t} selected={choose} onPress={() => applyDayMode(true)}
                title="Ik kies mijn eigen dagen"
                sub="Voor 'dag 1, dag 2'-schema's, of als een training op een dag valt die jou niet uitkomt. runyo verschuift de trainingen naar jouw dagen." />
            </View>
            {choose ? (
              <View style={[s.padH20, { paddingTop: 20 }]}>
                <View style={s.dayHeadRow}>
                  <Text style={[s.dayHeadTitle, { color: t.text }]}>Jouw trainingsdagen</Text>
                  <Text style={[s.dayHeadCount, { color: count > 0 ? t.accent : t.muted }]}>{count === 0 ? 'nog niets gekozen' : count === 1 ? '1 dag per week' : `${count} dagen per week`}</Text>
                </View>
                <DaySelector t={t} active={chooseDays} onToggle={i => {
                  setChooseDays(prev => {
                    const next = prev.map((v, j) => (j === i ? !v : v))
                    flow.setDayMode({ mode: 'choose', days: next.map((on, k) => (on ? k : -1)).filter(k => k >= 0) })
                    return next
                  })
                }} />
                <View style={{ marginTop: 16 }}>
                  <HintRow t={t}>De volgorde van je trainingen blijft behouden - ze verschuiven alleen naar de gekozen dagen. Rustdagen vullen de rest. Een vaste weekdag uit het document wordt overschreven.</HintRow>
                </View>
              </View>
            ) : null}
          </ScrollView>
        )
      }
      case 'analyze':
        return (
          <View style={[s.fill, s.center, { paddingHorizontal: 32 }]}>
            <Ring t={t} pct={flow.aPct} />
            <Text style={[s.analyzePhase, { color: t.text }]}>{analyzePhase(flow.aPct)}</Text>
            <Text style={[s.analyzeSub, { color: t.muted }]}>runyo leest je schema en deelt het in weken. Dit kan enkele minuten duren.</Text>
          </View>
        )
      case 'review': {
        const weeks = buildReviewWeeks(data.result?.rows ?? [], data.startDate)
        const totals = reviewTotals(weeks)
        const volMax = Math.max(1, ...weeks.map(w => w.km))
        const showNudge = data.result?.daysSignal === 'geen' && data.dayMode.mode === 'keep'
        return (
          <ScrollView style={s.fill} contentContainerStyle={{ paddingBottom: 16 }}>
            {data.error ? (
              <View style={[s.padH20, { paddingBottom: 6 }]}><HintRow t={t} tone="error">{data.error}</HintRow></View>
            ) : null}
            <ReviewSummary t={t} title={data.result?.schemaTitle ?? ''} weeks={totals.weeks} trainings={totals.trainings} km={totals.km}
              showNudge={showNudge} onChooseDays={() => { flow.setDayMode({ mode: 'choose', days: chooseDays.map((on, k) => (on ? k : -1)).filter(k => k >= 0) }); flow.jumpBackTo('trainingDays') }} />
            <View style={s.padH20}><ReviewLegend t={t} /></View>
            <View style={s.padH20}>
              {weeks.map(w => <WeekGroup key={w.num} t={t} week={w} volMax={volMax} />)}
            </View>
          </ScrollView>
        )
      }
      case 'saving':
        return (
          <View style={[s.fill, s.center, { paddingHorizontal: 32 }]}>
            <ActivityIndicator size="large" color={t.accent} />
            <Text style={[s.analyzePhase, { color: t.text }]}>Trainingen opslaan…</Text>
            <Text style={[s.savingCount, { color: t.muted }]}>{flow.savedCount} van {data.result?.rows.length ?? 0}</Text>
          </View>
        )
      case 'done': {
        const next = nextTraining(data.result?.rows ?? [], new Date().toISOString().slice(0, 10))
        return (
          <View style={[s.fill, s.padH20]}>
            <View style={s.flex1} />
            <View style={s.center}>
              <View style={[s.doneCheck, { backgroundColor: t.accent }]}>
                <Text style={[s.doneCheckMark, { color: t.accentInk }]}>✓</Text>
              </View>
              <Text style={[s.doneTitle, { color: t.text }]}>Klaar</Text>
              <Text style={[s.doneSub, { color: t.muted }]}>Je schema loopt nu mee.</Text>
            </View>
            {next ? (
              <View style={[s.doneCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={[s.doneDot, { backgroundColor: t.accent }]} />
                <View style={s.flex1}>
                  <Text style={[s.doneCardLabel, { color: t.muted }]}>Eerstvolgende training</Text>
                  <Text style={[s.doneCardTitle, { color: t.text }]}>{friendlyDate(next.datum).replace(/ \d{4}$/, '')} · {next.titel || 'Training'}</Text>
                </View>
                {next.km ? <Text style={[s.doneCardKm, { color: t.text }]}>{next.km}<Text style={{ color: t.muted, fontSize: 10 }}> km</Text></Text> : null}
              </View>
            ) : null}
            {overlap > 0 ? (
              <View style={[s.overlapBox, { backgroundColor: t.surface2 }]}>
                <View style={[s.overlapBadge, { borderColor: t.muted }]}><Text style={[s.overlapBadgeTxt, { color: t.muted }]}>i</Text></View>
                <Text style={[s.overlapTxt, { color: t.muted }]}>
                  <Text style={{ fontFamily: Fonts.displaySemiBold, color: t.text2 }}>{overlap === 1 ? '1 dag had al een training' : `${overlap} dagen hadden al een training`}</Text> - die staan nu samen. Je ontdubbelt ze zo in de schema-maker.
                </Text>
              </View>
            ) : null}
            <View style={{ flex: 1.3 }} />
          </View>
        )
      }
      case 'empty':
        return (
          <View style={[s.fill, s.center, { paddingHorizontal: 36 }]}>
            <View style={[s.qIcon, { borderColor: t.border, backgroundColor: t.surface }]}><Text style={[s.qIconTxt, { color: t.muted }]}>?</Text></View>
            <Text style={[s.emptyTitle, { color: t.text }]}>Geen schema gevonden</Text>
            <Text style={[s.emptySub, { color: t.muted }]}>runyo kon in dit bestand geen trainingsweken herkennen. Controleer of het echt een schema bevat, of probeer een andere bron - een spreadsheet of foto werkt soms beter.</Text>
            <View style={{ marginTop: 18, alignSelf: 'stretch' }}><MailHint t={t} /></View>
          </View>
        )
      case 'analyzeError':
        return (
          <View style={s.fill}>
            <StepHead t={t} title="Er ging iets mis" sub="Het analyseren is niet gelukt. Je instellingen zijn bewaard - je kunt het zo opnieuw proberen." />
            <View style={[s.padH20, { paddingTop: 20, gap: 14 }]}>
              <HintRow t={t} tone="error">Het schema kon niet worden verwerkt. Misschien viel je verbinding weg, of staat het document anders in elkaar dan verwacht.</HintRow>
              <View style={[s.recap, { backgroundColor: t.surface, borderColor: t.border }]}>
                {[['Bron', data.source === 'sheet' ? 'Google Sheet' : data.fileName || '-'],
                  ['Startdatum', friendlyDate(data.startDate)],
                  ['Trainingsdagen', data.dayMode.mode === 'choose' ? 'Eigen dagen' : 'Uit schema']].map(([k, v]) => (
                  <View key={k} style={s.recapRow}>
                    <Text style={[s.recapKey, { color: t.muted }]}>{k}</Text>
                    <Text numberOfLines={1} style={[s.recapVal, { color: t.text }]}>{v}</Text>
                  </View>
                ))}
              </View>
              <MailHint t={t} />
            </View>
            <View style={s.flex1} />
          </View>
        )
    }
  }

  // ── Per-step CTA / onderbalk ─────────────────────────────────────────────────
  function renderCTA() {
    switch (step) {
      case 'sheetLink':
        return <PinnedCTA t={t} label="Verder" disabled={!data.link.trim()} onPress={() => flow.go('startDate')} />
      case 'confirm':
        return <PinnedCTA t={t} label="Verder" block={sizeCheck.level === 'block'} onPress={() => flow.go('startDate')} />
      case 'startDate':
        return <PinnedCTA t={t} label="Verder" onPress={() => flow.go('trainingDays')} />
      case 'trainingDays': {
        const choose = data.dayMode.mode === 'choose'
        const zero = choose && chooseDays.filter(Boolean).length === 0
        return <PinnedCTA t={t} label="Schema analyseren" disabled={zero} hint={zero ? 'Kies minstens één trainingsdag om door te gaan.' : null} onPress={runAnalyze} />
      }
      case 'analyze':
        return flow.showCancel ? (
          <View style={s.analyzeFoot}>
            <TouchableOpacity activeOpacity={0.85} onPress={cancelAnalyze}
              style={[s.cancelBtn, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[s.cancelBtnTxt, { color: t.text }]}>Annuleren en aanpassen</Text>
            </TouchableOpacity>
          </View>
        ) : null
      case 'review':
        return <PinnedCTA t={t} label="Schema importeren" secondary="← Opnieuw analyseren" onSecondary={() => flow.jumpBackTo('trainingDays')} onPress={runSave} />
      case 'done':
        return (
          <View style={[s.doneFoot, { backgroundColor: t.bg, borderTopColor: t.border }]}>
            <TouchableOpacity activeOpacity={0.85} onPress={finish} style={[s.donePrimary, { backgroundColor: t.accent }]}>
              <Text style={[s.donePrimaryTxt, { color: t.accentInk }]}>Naar vandaag</Text>
              <Text style={[s.donePrimaryTxt, { color: t.accentInk }]}>→</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} onPress={finish} style={[s.doneSecondary, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[s.doneSecondaryTxt, { color: t.text }]}>Schema aanpassen</Text>
            </TouchableOpacity>
          </View>
        )
      case 'empty':
        return <PinnedCTA t={t} label="Opnieuw proberen" arrow={false} secondary="← Andere bron kiezen" onSecondary={() => flow.jumpBackTo('source')} onPress={runAnalyze} />
      case 'analyzeError':
        return <PinnedCTA t={t} label="Opnieuw analyseren" secondary="← Andere bron kiezen" onSecondary={() => flow.jumpBackTo('source')} onPress={runAnalyze} />
      default:
        return null
    }
  }

  function handleClose() {
    if (flow.canClose) flow.setClosing(true)
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <SafeAreaView style={[s.root, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <WizardTopBar t={t} phaseIndex={flow.phaseIndex} showBack={flow.canBack} showClose={flow.canClose}
          onBack={flow.back} onClose={handleClose} />
        <Animated.View style={[s.body, flow.animStyle]}>
          {renderBody()}
        </Animated.View>
        {renderCTA()}
        {flow.closing ? (
          <AbortSheet t={t} onContinue={() => flow.setClosing(false)} onAbort={() => { flow.setClosing(false); close() }} />
        ) : null}
      </SafeAreaView>
    </Modal>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, minHeight: 0 },
  fill: { flex: 1, minHeight: 0 },
  flex1: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  padH20: { paddingHorizontal: 20 },
  bold: { fontFamily: Fonts.displaySemiBold },
  tileList: { paddingHorizontal: 20, paddingTop: 22, gap: 12 },
  err: { fontFamily: Fonts.display, fontSize: 13, paddingHorizontal: 20, marginTop: 12 },
  linkInput: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontFamily: Fonts.mono, fontSize: 12.5 },
  dayHeadRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 11 },
  dayHeadTitle: { fontFamily: Fonts.displaySemiBold, fontSize: 14, letterSpacing: -0.15 },
  dayHeadCount: { fontFamily: Fonts.mono, fontSize: 11.5 },
  analyzePhase: { fontFamily: Fonts.displaySemiBold, fontSize: 18, letterSpacing: -0.4, marginTop: 28 },
  analyzeSub: { fontFamily: Fonts.display, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 8, maxWidth: 250 },
  analyzeFoot: { paddingHorizontal: 20, paddingBottom: 30, alignItems: 'center', gap: 16 },
  cancelBtn: { width: '100%', height: 52, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelBtnTxt: { fontFamily: Fonts.displaySemiBold, fontSize: 15, letterSpacing: -0.2 },
  savingCount: { fontFamily: Fonts.mono, fontSize: 12, marginTop: 8 },
  // done
  doneCheck: { width: 76, height: 76, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  doneCheckMark: { fontFamily: Fonts.displayBold, fontSize: 36 },
  doneTitle: { fontFamily: Fonts.displayBold, fontSize: 27, letterSpacing: -0.9, marginTop: 22 },
  doneSub: { fontFamily: Fonts.display, fontSize: 14.5, marginTop: 7 },
  doneCard: { marginTop: 26, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 13 },
  doneDot: { width: 9, height: 9, borderRadius: 999 },
  doneCardLabel: { fontFamily: Fonts.mono, fontSize: 11 },
  doneCardTitle: { fontFamily: Fonts.displaySemiBold, fontSize: 14.5, marginTop: 4, letterSpacing: -0.15 },
  doneCardKm: { fontFamily: Fonts.monoMedium, fontSize: 13 },
  overlapBox: { marginTop: 12, flexDirection: 'row', gap: 11, alignItems: 'flex-start', padding: 12, borderRadius: 12 },
  overlapBadge: { width: 17, height: 17, borderRadius: 999, borderWidth: 1.5, marginTop: 1, alignItems: 'center', justifyContent: 'center' },
  overlapBadgeTxt: { fontFamily: Fonts.displayBold, fontSize: 11 },
  overlapTxt: { flex: 1, fontFamily: Fonts.display, fontSize: 12.5, lineHeight: 18 },
  doneFoot: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22, borderTopWidth: 1, gap: 10 },
  donePrimary: { height: 52, borderRadius: 8, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  donePrimaryTxt: { fontFamily: Fonts.displayBold, fontSize: 15.5, letterSpacing: -0.2 },
  doneSecondary: { height: 50, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  doneSecondaryTxt: { fontFamily: Fonts.displaySemiBold, fontSize: 14.5 },
  // empty
  qIcon: { width: 64, height: 64, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  qIconTxt: { fontFamily: Fonts.display, fontSize: 30 },
  emptyTitle: { fontFamily: Fonts.displayBold, fontSize: 21, letterSpacing: -0.6, marginTop: 22 },
  emptySub: { fontFamily: Fonts.display, fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginTop: 9, maxWidth: 280 },
  // analyze error recap
  recap: { borderWidth: 1, borderRadius: 12, padding: 13, gap: 9 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  recapKey: { fontFamily: Fonts.display, fontSize: 12.5 },
  recapVal: { fontFamily: Fonts.mono, fontSize: 11.5, flexShrink: 1 },
})
