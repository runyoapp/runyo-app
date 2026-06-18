import { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { ModalSheet } from '@/components/shared/ModalSheet'
import { useDataStore } from '@/stores/dataStore'
import { Fonts, Spacing, Radius, ActivityColors, type Theme } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { TYPE_DISPLAY, type ActivityType } from '@/constants/activities'
import { effectiveSpan } from '@/utils/schemaRouting'
import { addDays, fromDateString, toDateString } from '@/utils/date'
import type { Activity } from '@/types/activity'
import type { SchemaMeta } from '@/stores/dataStore'

// Afstanden waarvoor we een PR bijhouden (app-set; PR-data is hierop gekeyd).
const PR_DISTANCES = ['1 km', '5 km', '10 km', '10 mile', 'Halve marathon', 'Marathon']

// Vaste kleuren voor fases (vrij-tekstveld). Toegekend op volgorde van eerste
// voorkomen in het blok; werken in light én dark. Accent eerst.
const FASE_PALETTE = ['#00B98E', '#5B8BF5', '#E0913C', '#E54B3C', '#8E5BD6', '#1E8FD6', '#2E7D5E']

type Props = { visible: boolean; onClose: () => void }

type WeekStatus = 'past' | 'current' | 'future'
type BlockWeek = { num: number; planKm: number; status: WeekStatus; fase: string | null }

// Per-week plan-km + status + dominante fase voor het huidige blok, langs de
// vaste plan-span (effectiveSpan = bron van waarheid, zoals PlanScreen). Puur
// plan-gebaseerd: we tonen wat gepland staat, niet of het echt gelopen is.
function buildBlockWeeks(activities: Activity[], schema: SchemaMeta | null, today: string): BlockWeek[] {
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

    // Dominante fase = meest voorkomende niet-lege fase die week.
    const tally: Record<string, number> = {}
    days.forEach(a => { if (a.fase?.trim()) tally[a.fase.trim()] = (tally[a.fase.trim()] ?? 0) + 1 })
    const fase = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    const status: WeekStatus = sun < today ? 'past' : (mon <= today ? 'current' : 'future')
    weeks.push({ num, planKm, status, fase })
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
  const totalKm   = weeks.reduce((s, w) => s + w.planKm, 0)
  const elapsedKm = weeks.filter(w => w.status !== 'future').reduce((s, w) => s + w.planKm, 0)
  const maxPlan   = Math.max(...weeks.map(w => w.planKm), 1)
  const pct       = totalKm > 0 ? Math.round((elapsedKm / totalKm) * 100) : 0

  // Fase-kleurmap: elke aanwezige fase een vaste paletkleur (volgorde van voorkomen).
  const faseColors = useMemo(() => {
    const order: string[] = []
    weeks.forEach(w => { if (w.fase && !order.includes(w.fase)) order.push(w.fase) })
    return Object.fromEntries(order.map((f, i) => [f, FASE_PALETTE[i % FASE_PALETTE.length]]))
  }, [weeks])
  const fases = Object.keys(faseColors)

  // Verdeling per type (km + sessies) over het blok.
  const typeDist = useMemo(() => {
    if (!schema) return []
    const own = activities.filter(a => a.schemaId === schema.id && a.type !== 'work' && a.type !== 'rest')
    const agg: Record<string, { km: number; count: number }> = {}
    own.forEach(a => {
      const e = agg[a.type] ?? (agg[a.type] = { km: 0, count: 0 })
      e.km += a.km ?? 0; e.count += 1
    })
    return Object.entries(agg)
      .map(([type, v]) => ({ type: type as ActivityType, km: Math.round(v.km), count: v.count }))
      .sort((a, b) => b.km - a.km || b.count - a.count)
  }, [activities, schema])
  const maxTypeKm = Math.max(...typeDist.map(t => t.km), 1)

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
        {/* hero — plan-voortgang */}
        <View style={styles.heroRow}>
          <View>
            <Text style={[styles.heroNum, { color: theme.text }]}>
              {elapsedKm}
              <Text style={[styles.heroUnit, { color: theme.muted }]}> km</Text>
            </Text>
            <Text style={[styles.heroSub, { color: theme.muted }]}>gepland tot nu toe</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.heroPlan, { color: theme.text }]}>{totalKm} km</Text>
            <Text style={[styles.heroPlanSub, { color: theme.muted }]}>totaal dit blok</Text>
          </View>
        </View>

        {/* voortgang door het blok */}
        <View style={{ marginTop: 14 }}>
          <View style={[styles.progTrack, { backgroundColor: theme.surface2 }]}>
            <View style={[styles.progFill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
          </View>
          <Text style={[styles.progLabel, { color: theme.muted }]}>
            {pct}% van het blok
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
                const h = (w.planKm / maxPlan) * 78
                const col = w.fase ? faseColors[w.fase] : theme.accent
                const future = w.status === 'future'
                const current = w.status === 'current'
                return (
                  <View key={w.num} style={styles.barCol}>
                    <View style={[
                      styles.barTrack,
                      { height: h, backgroundColor: theme.border },
                    ]}>
                      <View style={[
                        styles.barFill,
                        { height: h, backgroundColor: col, opacity: future ? 0.32 : 1 },
                        current && { borderWidth: 2, borderColor: theme.text },
                      ]} />
                    </View>
                    <Text style={[
                      styles.barLabel,
                      { color: current ? theme.text : theme.muted },
                      current && { fontFamily: Fonts.monoMedium },
                    ]}>{w.num}</Text>
                  </View>
                )
              })}
            </View>
            {/* legenda */}
            {fases.length > 0 ? (
              <View style={styles.legend}>
                {fases.map(f => (
                  <View key={f} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: faseColors[f] }]} />
                    <Text style={[styles.legendLabel, { color: theme.muted }]}>{f}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
                  <Text style={[styles.legendLabel, { color: theme.muted }]}>verstreken</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.accent, opacity: 0.32 }]} />
                  <Text style={[styles.legendLabel, { color: theme.muted }]}>komend</Text>
                </View>
              </View>
            )}
          </>
        )}
      </Card>

      <View style={{ height: 22 }} />

      {/* ── Verdeling per type ───────────────────────────── */}
      {typeDist.length > 0 && (
        <>
          <SectionLabel theme={theme}>Verdeling per type</SectionLabel>
          <Card theme={theme} style={{ padding: Spacing.lg, gap: 12 }}>
            {typeDist.map(t => {
              const col = ActivityColors[t.type]?.text ?? theme.accent
              return (
                <View key={t.type} style={styles.typeRow}>
                  <View style={styles.typeHead}>
                    <View style={[styles.legendDot, { backgroundColor: col }]} />
                    <Text style={[styles.typeName, { color: theme.text }]}>
                      {TYPE_DISPLAY[t.type]?.nl ?? t.type}
                    </Text>
                    <Text style={[styles.typeMeta, { color: theme.muted }]}>
                      {t.km > 0 ? `${t.km} km · ` : ''}{t.count}×
                    </Text>
                  </View>
                  <View style={[styles.typeTrack, { backgroundColor: theme.surface2 }]}>
                    <View style={[styles.typeFill, { width: `${Math.round((t.km / maxTypeKm) * 100)}%`, backgroundColor: col }]} />
                  </View>
                </View>
              )
            })}
          </Card>
          <View style={{ height: 22 }} />
        </>
      )}

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
  barTrack:     { width: '100%', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill:      { width: '100%', borderRadius: 4 },
  barLabel:     { fontFamily: Fonts.mono, fontSize: 8 },
  empty:        { fontFamily: Fonts.display, fontSize: 13, marginTop: 4, paddingVertical: 8 },

  legend:       { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:    { width: 9, height: 9, borderRadius: 3 },
  legendLabel:  { fontFamily: Fonts.display, fontSize: 11.5, textTransform: 'capitalize' },

  typeRow:      { gap: 7 },
  typeHead:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeName:     { flex: 1, fontFamily: Fonts.displayMedium, fontSize: 14 },
  typeMeta:     { fontFamily: Fonts.mono, fontSize: 11.5 },
  typeTrack:    { height: 6, borderRadius: 999, overflow: 'hidden' },
  typeFill:     { height: '100%', borderRadius: 999 },

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
