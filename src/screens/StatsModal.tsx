import { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { ModalSheet } from '@/components/shared/ModalSheet'
import { useDataStore } from '@/stores/dataStore'
import { Fonts, Spacing, Radius, type Theme } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { effectiveSpan } from '@/utils/schemaRouting'
import { addDays, fromDateString, toDateString } from '@/utils/date'

// Afstanden waarvoor we een PR bijhouden (app-set; PR-data is hierop gekeyd).
const PR_DISTANCES = ['1 km', '5 km', '10 km', '10 mile', 'Halve marathon', 'Marathon']

type Props = { visible: boolean; onClose: () => void }

type BlockWeek = { num: number; planKm: number; doneKm: number; isCurrent: boolean }

// Per-week plan/gelopen km voor het huidige blok, langs de vaste plan-span.
// Spiegelt PlanScreen.buildWeeks (span = bron van waarheid), maar dan platgeslagen
// tot enkel de km-cijfers die de grafiek nodig heeft.
function buildBlockWeeks(
  activities: ReturnType<typeof useDataStore.getState>['activities'],
  schema: ReturnType<typeof useDataStore.getState>['schemaList'][number] | null,
  today: string,
): BlockWeek[] {
  if (!schema) return []
  const span = effectiveSpan(activities, schema)
  const own = activities.filter(
    a => a.schemaId === schema.id && a.type !== 'work' && a.type !== 'rest',
  )
  const weeks: BlockWeek[] = []
  let cursor = fromDateString(span.start)
  for (let num = 1; num <= span.weeks; num++) {
    const mon = toDateString(cursor)
    const sun = toDateString(addDays(cursor, 6))
    const days = own.filter(a => a.datum >= mon && a.datum <= sun)
    const planKm = Math.round(days.reduce((s, a) => s + (a.km ?? 0), 0))
    const doneKm = Math.round(
      days.filter(a => a.datum <= today).reduce((s, a) => s + (a.km ?? 0), 0),
    )
    weeks.push({ num, planKm, doneKm, isCurrent: mon <= today && today <= sun })
    cursor = addDays(cursor, 7)
  }
  return weeks
}

export function StatsModal({ visible, onClose }: Props) {
  const theme      = useTheme()
  const activities = useDataStore(s => s.activities)
  const schemaId   = useDataStore(s => s.schemaId)
  const schemaList = useDataStore(s => s.schemaList)
  const prs        = useDataStore(s => s.prs)
  const setPrs     = useDataStore(s => s.setPrs)

  const [editingPrs, setEditingPrs] = useState(false)
  const [prDraft, setPrDraft] = useState<Record<string, string>>({})

  const today  = useMemo(() => toDateString(new Date()), [])
  const schema = useMemo(
    () => schemaList.find(s => s.id === schemaId) ?? null,
    [schemaList, schemaId],
  )

  const weeks   = useMemo(() => buildBlockWeeks(activities, schema, today), [activities, schema, today])
  const totDone = weeks.reduce((s, w) => s + w.doneKm, 0)
  const totPlan = weeks.reduce((s, w) => s + w.planKm, 0)
  const maxPlan = Math.max(...weeks.map(w => w.planKm), 1)
  const pct     = totPlan > 0 ? Math.round((totDone / totPlan) * 100) : 0

  // Races: gepland binnen dit blok (nog te lopen) vs totaal ooit gelopen.
  const blockRacesPlanned = schema
    ? activities.filter(a => a.schemaId === schema.id && a.type === 'race' && a.datum >= today).length
    : 0
  const racesDone = activities.filter(a => a.type === 'race' && a.datum < today).length

  function startEditPrs() {
    const draft: Record<string, string> = {}
    prs.forEach(pr => { draft[pr.distance] = pr.time })
    setPrDraft(draft)
    setEditingPrs(true)
  }
  function savePrs() {
    setPrs(Object.entries(prDraft)
      .filter(([, v]) => v.trim())
      .map(([distance, time]) => ({ distance, time: time.trim() })))
    setEditingPrs(false)
  }

  return (
    <ModalSheet visible={visible} title="Stats" subtitle={schema?.name} onClose={onClose}>
      {/* ── Kilometers ───────────────────────────────────── */}
      <SectionLabel theme={theme}>Kilometers</SectionLabel>
      <Card theme={theme} style={{ padding: Spacing.lg }}>
        {/* hero */}
        <View style={styles.heroRow}>
          <View>
            <Text style={[styles.heroNum, { color: theme.text }]}>
              {totDone}
              <Text style={[styles.heroUnit, { color: theme.muted }]}> km</Text>
            </Text>
            <Text style={[styles.heroSub, { color: theme.muted }]}>gelopen dit blok</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.heroPlan, { color: theme.text }]}>{totPlan} km</Text>
            <Text style={[styles.heroPlanSub, { color: theme.muted }]}>gepland</Text>
          </View>
        </View>

        {/* progress */}
        <View style={{ marginTop: 14 }}>
          <View style={[styles.progTrack, { backgroundColor: theme.surface2 }]}>
            <View style={[styles.progFill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
          </View>
          <Text style={[styles.progLabel, { color: theme.muted }]}>
            {pct}% van de geplande km voltooid
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {/* grafiek per week */}
        <Text style={[styles.chartTitle, { color: theme.text }]}>Per week</Text>
        {weeks.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>Nog geen schema om te tonen.</Text>
        ) : (
          <>
            <View style={styles.chart}>
              {weeks.map(w => {
                const h  = (w.planKm / maxPlan) * 78
                const dh = (w.doneKm / maxPlan) * 78
                return (
                  <View key={w.num} style={styles.barCol}>
                    <View style={[
                      styles.barGhost,
                      { height: h, backgroundColor: theme.border },
                      w.isCurrent && { borderWidth: 2, borderColor: theme.text },
                    ]}>
                      <View style={[styles.barFill, { height: dh, backgroundColor: theme.accent, opacity: w.isCurrent ? 1 : 0.92 }]} />
                    </View>
                    <Text style={[
                      styles.barLabel,
                      { color: w.isCurrent ? theme.text : theme.muted },
                      w.isCurrent && { fontFamily: Fonts.monoMedium },
                    ]}>{w.num}</Text>
                  </View>
                )
              })}
            </View>
            {/* legenda */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
                <Text style={[styles.legendLabel, { color: theme.muted }]}>gelopen</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.border }]} />
                <Text style={[styles.legendLabel, { color: theme.muted }]}>gepland</Text>
              </View>
            </View>
          </>
        )}
      </Card>

      <View style={{ height: 22 }} />

      {/* ── Races ────────────────────────────────────────── */}
      <SectionLabel theme={theme}>Races</SectionLabel>
      <View style={styles.tileRow}>
        <RaceTile theme={theme} value={String(blockRacesPlanned)} label="gepland dit blok" accent />
        <RaceTile theme={theme} value={String(racesDone)} label="totaal gelopen" />
      </View>

      <View style={{ height: 22 }} />

      {/* ── Persoonlijke records ─────────────────────────── */}
      <View style={styles.prHeader}>
        <SectionLabel theme={theme}>Persoonlijke records</SectionLabel>
        <TouchableOpacity onPress={editingPrs ? savePrs : startEditPrs} style={{ paddingBottom: 9 }}>
          <Text style={[styles.editLink, { color: theme.accent }]}>
            {editingPrs ? 'Opslaan' : 'Bewerken'}
          </Text>
        </TouchableOpacity>
      </View>
      <Card theme={theme}>
        {PR_DISTANCES.map((dist, i) => {
          const pr = prs.find(p => p.distance === dist)
          const empty = !pr?.time
          return (
            <View key={dist} style={[
              styles.prRow,
              i < PR_DISTANCES.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
            ]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.prDist, { color: empty ? theme.muted : theme.text }]}>{dist}</Text>
              </View>
              {editingPrs ? (
                <TextInput
                  style={[styles.prInput, { color: theme.text, borderColor: theme.border }]}
                  value={prDraft[dist] ?? ''}
                  onChangeText={v => setPrDraft(d => ({ ...d, [dist]: v }))}
                  placeholder="37:30"
                  placeholderTextColor={theme.faint}
                  keyboardType="numbers-and-punctuation"
                />
              ) : (
                <Text style={[
                  styles.prTime,
                  { color: empty ? theme.border : theme.text },
                  empty && { fontSize: 15 },
                ]}>{pr?.time ?? '- : - -'}</Text>
              )}
            </View>
          )
        })}
      </Card>
    </ModalSheet>
  )
}

// ── atoms ──────────────────────────────────────────────────
function SectionLabel({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return <Text style={[styles.sectionLabel, { color: theme.muted }]}>{children}</Text>
}
function Card({ children, theme, style }: { children: React.ReactNode; theme: Theme; style?: any }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      {children}
    </View>
  )
}
function RaceTile({ value, label, accent, theme }: { value: string; label: string; accent?: boolean; theme: Theme }) {
  return (
    <Card theme={theme} style={styles.tile}>
      <Text style={[styles.tileVal, { color: accent ? theme.accent : theme.text }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: theme.muted }]}>{label}</Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  sectionLabel: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', paddingHorizontal: 4, paddingBottom: 9 },
  card:         { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  divider:      { height: 1, marginTop: 16 },

  heroRow:      { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  heroNum:      { fontFamily: Fonts.displayBold, fontSize: 44, letterSpacing: -1.7, lineHeight: 46 },
  heroUnit:     { fontFamily: Fonts.displayMedium, fontSize: 19 },
  heroSub:      { fontFamily: Fonts.display, fontSize: 13, marginTop: 5 },
  heroPlan:     { fontFamily: Fonts.displaySemiBold, fontSize: 18, letterSpacing: -0.4 },
  heroPlanSub:  { fontFamily: Fonts.display, fontSize: 12.5, marginTop: 3 },

  progTrack:    { height: 8, borderRadius: 999, overflow: 'hidden' },
  progFill:     { height: '100%', borderRadius: 999 },
  progLabel:    { fontFamily: Fonts.mono, fontSize: 11, marginTop: 7 },

  chartTitle:   { fontFamily: Fonts.displaySemiBold, fontSize: 13.5, marginTop: 16, marginBottom: 12 },
  chart:        { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 92 },
  barCol:       { flex: 1, alignItems: 'center', gap: 4 },
  barGhost:     { width: '100%', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill:      { width: '100%', borderRadius: 4 },
  barLabel:     { fontFamily: Fonts.mono, fontSize: 8 },
  empty:        { fontFamily: Fonts.display, fontSize: 13, marginTop: 4, paddingVertical: 8 },

  legend:       { flexDirection: 'row', gap: 16, marginTop: 12 },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:    { width: 9, height: 9, borderRadius: 3 },
  legendLabel:  { fontFamily: Fonts.display, fontSize: 11.5 },

  tileRow:      { flexDirection: 'row', gap: 10 },
  tile:         { flex: 1, paddingVertical: 15, paddingHorizontal: 16 },
  tileVal:      { fontFamily: Fonts.displayBold, fontSize: 34, lineHeight: 34, letterSpacing: -1 },
  tileLabel:    { fontFamily: Fonts.display, fontSize: 12.5, marginTop: 6 },

  prHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editLink:     { fontFamily: Fonts.displayMedium, fontSize: 13 },
  prRow:        { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 14 },
  prDist:       { fontFamily: Fonts.displaySemiBold, fontSize: 14.5, letterSpacing: -0.15 },
  prTime:       { fontFamily: Fonts.monoMedium, fontSize: 18, letterSpacing: 0.2 },
  prInput:      { fontFamily: Fonts.mono, fontSize: 14, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, minWidth: 80, textAlign: 'right' },
})
