import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { ModalSheet } from '@/components/shared/ModalSheet'
import { useDataStore } from '@/stores/dataStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { ActivityColors, LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { TYPE_DISPLAY, ACTIVITY_TYPES } from '@/constants/activities'
import type { ActivityType } from '@/constants/activities'

const PR_DISTANCES = ['1 km', '5 km', '10 km', '10 mile', 'Halve marathon', 'Marathon']

type Props = { visible: boolean; onClose: () => void }

export function StatsModal({ visible, onClose }: Props) {
  const activities = useDataStore(s => s.activities)
  const prs        = useDataStore(s => s.prs)
  const setPrs     = useDataStore(s => s.setPrs)

  const [editingPrs, setEditingPrs] = useState(false)
  const [prDraft, setPrDraft] = useState<Record<string, string>>({})

  const today = new Date().toISOString().split('T')[0]
  const past  = activities.filter(a => a.datum <= today)

  // Stats per type
  const byType = ACTIVITY_TYPES.reduce((acc, t) => {
    const rows = past.filter(a => a.type === t)
    acc[t] = { count: rows.length, km: rows.reduce((s, r) => s + (r.km ?? 0), 0) }
    return acc
  }, {} as Record<string, { count: number; km: number }>)

  const totalKm  = past.reduce((s, a) => s + (a.km ?? 0), 0)
  const totalRuns = past.filter(a => a.type === 'run').length

  // Monthly km (last 6 months)
  const monthStats = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0')
    const prefix = `${y}-${m}`
    const km = past.filter(a => a.datum.startsWith(prefix) && a.type === 'run')
                   .reduce((s, a) => s + (a.km ?? 0), 0)
    const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
    return { label: MONTHS[d.getMonth()], km }
  })
  const maxKm = Math.max(...monthStats.map(m => m.km), 1)

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
    <ModalSheet visible={visible} title="Statistieken" onClose={onClose}>
      {/* Summary row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryVal}>{Math.round(totalKm)}</Text>
          <Text style={styles.summaryLabel}>km totaal</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryVal}>{totalRuns}</Text>
          <Text style={styles.summaryLabel}>runs</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryVal}>{past.length}</Text>
          <Text style={styles.summaryLabel}>activiteiten</Text>
        </View>
      </View>

      {/* Monthly bar chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Km per maand</Text>
        <View style={styles.barChart}>
          {monthStats.map(({ label, km }) => (
            <View key={label} style={styles.barCol}>
              <Text style={styles.barKm}>{km > 0 ? Math.round(km) : ''}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${Math.round(km / maxKm * 100)}%` as any }]} />
              </View>
              <Text style={styles.barLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* By type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Per type</Text>
        {ACTIVITY_TYPES.filter(t => byType[t].count > 0).map(t => {
          const color = ActivityColors[t as ActivityType]?.text ?? LightTheme.accent
          const label = TYPE_DISPLAY[t as ActivityType]?.nl ?? t
          return (
            <View key={t} style={styles.typeRow}>
              <View style={[styles.typeDot, { backgroundColor: color }]} />
              <Text style={styles.typeLabel}>{label}</Text>
              <Text style={styles.typeCount}>{byType[t].count}×</Text>
              {byType[t].km > 0 && (
                <Text style={styles.typeKm}>{Math.round(byType[t].km)} km</Text>
              )}
            </View>
          )
        })}
      </View>

      {/* PRs */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Persoonlijke records</Text>
          <TouchableOpacity onPress={editingPrs ? savePrs : startEditPrs}>
            <Text style={styles.editLink}>{editingPrs ? 'Opslaan' : 'Bewerken'}</Text>
          </TouchableOpacity>
        </View>
        {PR_DISTANCES.map(dist => {
          const pr = prs.find(p => p.distance === dist)
          return (
            <View key={dist} style={styles.prRow}>
              <Text style={styles.prDist}>{dist}</Text>
              {editingPrs ? (
                <TextInput
                  style={styles.prInput}
                  value={prDraft[dist] ?? ''}
                  onChangeText={v => setPrDraft(d => ({ ...d, [dist]: v }))}
                  placeholder="37:30"
                  placeholderTextColor={LightTheme.faint}
                  keyboardType="numbers-and-punctuation"
                />
              ) : (
                <Text style={styles.prTime}>{pr?.time ?? '—'}</Text>
              )}
            </View>
          )
        })}
      </View>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  summaryRow:    { flexDirection: 'row', gap: Spacing.sm },
  summaryCard:   { flex: 1, backgroundColor: LightTheme.surface, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  summaryVal:    { fontFamily: Fonts.displayBold, fontSize: 28, color: LightTheme.text, letterSpacing: -1 },
  summaryLabel:  { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted, marginTop: 2 },
  section:       { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle:  { fontFamily: Fonts.displaySemiBold, fontSize: 13, color: LightTheme.text },
  editLink:      { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.accent },
  barChart:      { flexDirection: 'row', gap: Spacing.sm, height: 100, alignItems: 'flex-end' },
  barCol:        { flex: 1, alignItems: 'center', gap: 4 },
  barKm:         { fontFamily: Fonts.mono, fontSize: 9, color: LightTheme.muted },
  barTrack:      { flex: 1, width: '100%', backgroundColor: LightTheme.border, borderRadius: 3, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill:       { width: '100%', backgroundColor: LightTheme.accent, borderRadius: 3 },
  barLabel:      { fontFamily: Fonts.mono, fontSize: 10, color: LightTheme.muted },
  typeRow:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  typeDot:       { width: 8, height: 8, borderRadius: 4 },
  typeLabel:     { flex: 1, fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text },
  typeCount:     { fontFamily: Fonts.mono, fontSize: 12, color: LightTheme.muted },
  typeKm:        { fontFamily: Fonts.mono, fontSize: 12, color: LightTheme.muted, width: 56, textAlign: 'right' },
  prRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: LightTheme.border },
  prDist:        { flex: 1, fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text },
  prTime:        { fontFamily: Fonts.monoMedium, fontSize: 15, color: LightTheme.accent },
  prInput:       { fontFamily: Fonts.mono, fontSize: 14, color: LightTheme.text, borderWidth: 1, borderColor: LightTheme.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, minWidth: 80, textAlign: 'right' },
})
