import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { patchActivity, deleteActivity } from '@/services/activities'
import { PageContainer } from '@/components/shared/PageContainer'
import {
  FieldLabel, EditorTextField, EditorTextArea, DistanceStepper,
} from '@/components/shared/editor'
import { IntervalEditor } from '@/components/shared/IntervalEditor'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import { activityColor } from '@/utils/runCategory'
import type { Activity, IntervalBlock } from '@/types/activity'

type Props = {
  activity: Activity
  onBack: () => void
}

export function EditorScreen({ activity, onBack }: Props) {
  const theme          = useTheme()
  const insets         = useSafeAreaInsets()
  const schemaId       = useDataStore(s => s.schemaId)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const removeActivity = useDataStore(s => s.removeActivity)
  const showToast      = useUiStore(s => s.showToast)
  const queryClient    = useQueryClient()

  const [km,         setKm]         = useState(activity.km ?? 0)
  const [titel,      setTitel]      = useState(activity.titel)
  const [detail,     setDetail]     = useState(activity.detail)
  const [targetPace, setTargetPace] = useState(activity.targetPace ?? '')
  const [targetHr,   setTargetHr]   = useState(activity.targetHr != null ? String(activity.targetHr) : '')
  const [intervals,  setIntervals]  = useState<IntervalBlock[]>(activity.intervals ?? [])
  const [intervalsOpen, setIntervalsOpen] = useState(false)
  const [saving,     setSaving]     = useState(false)

  // Intervallen horen bij hardloopsessies — voor élke run beschikbaar (geen
  // titel-/trefwoord-gok meer), getoond als inklapbare sectie net als in de
  // DayDetailModal zodat beide editors gelijklopen.
  const showIntervals = activity.type === 'run'

  async function handleSave() {
    if (!schemaId || saving) return
    setSaving(true)
    const hrNum = targetHr.trim() ? Number(targetHr.trim()) : null
    const patch = {
      km: km > 0 ? km : null,
      titel: titel || null,
      detail: detail || null,
      targetPace: targetPace.trim() || null,
      targetHr: hrNum != null && !Number.isNaN(hrNum) ? hrNum : null,
      intervals: intervals.length ? intervals : null,
    }
    const optimistic: Activity = {
      ...activity,
      km: patch.km,
      titel: patch.titel ?? '',
      detail: patch.detail ?? '',
      targetPace: patch.targetPace,
      targetHr: patch.targetHr,
      intervals: patch.intervals,
    }
    upsertActivity(optimistic)
    try {
      const updated = await patchActivity(schemaId, activity.id, patch)
      upsertActivity(updated)
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast('Opgeslagen')
      onBack()
    } catch {
      upsertActivity(activity)
      showToast('Opslaan mislukt, probeer opnieuw.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!schemaId) return
    removeActivity(activity.id)
    onBack()
    try {
      await deleteActivity(schemaId, activity.id)
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast('Verwijderd')
    } catch {
      upsertActivity(activity)
      showToast('Verwijderen mislukt, probeer opnieuw.')
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <PageContainer>
        {/* Terug-header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.squareBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Text style={[styles.squareBtnText, { color: theme.text }]}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headMid}>
            <View style={[styles.headBar, { backgroundColor: activityColor(activity, theme) }]} />
            <Text style={[styles.headTitle, { color: theme.text }]} numberOfLines={1}>
              {titel || activity.type}
            </Text>
          </View>
          <TouchableOpacity onPress={handleDelete} activeOpacity={0.7}>
            <Text style={[styles.deleteLink, { color: theme.danger }]}>Verwijder</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Afstand */}
          <View style={styles.section}>
            <FieldLabel>Afstand</FieldLabel>
            <DistanceStepper value={km} onChange={setKm} />
          </View>

          {/* Pace + HR */}
          <View style={styles.paceRow}>
            <View style={{ flex: 1 }}>
              <FieldLabel>Streefpace</FieldLabel>
              <EditorTextField value={targetPace} onChangeText={setTargetPace} placeholder="4:30" mono />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel>Hartslag</FieldLabel>
              <EditorTextField value={targetHr} onChangeText={setTargetHr} placeholder="145" keyboardType="numeric" />
            </View>
          </View>

          {/* Intervallen — inklapbaar, beschikbaar voor elke run */}
          {showIntervals && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.intervalsHead}
                activeOpacity={0.7}
                onPress={() => setIntervalsOpen(o => !o)}
              >
                <FieldLabel hint={intervals.length ? `· ${intervals.length} ${intervals.length === 1 ? 'blok' : 'blokken'}` : undefined}>
                  Intervallen
                </FieldLabel>
                <Text style={[styles.intervalsChevron, { color: theme.muted }, intervalsOpen && styles.intervalsChevronOpen]}>›</Text>
              </TouchableOpacity>
              {intervalsOpen && <IntervalEditor intervals={intervals} onChange={setIntervals} />}
            </View>
          )}

          {/* Titel */}
          <View style={styles.section}>
            <FieldLabel>Titel</FieldLabel>
            <EditorTextField value={titel} onChangeText={setTitel} placeholder="bv. Tempo 4×1km" />
          </View>

          {/* Notitie */}
          <View style={styles.section}>
            <FieldLabel hint="· optioneel">Notitie</FieldLabel>
            <EditorTextArea value={detail} onChangeText={setDetail} placeholder="Notities, tempo, HR…" />
          </View>

          {/* Opslaan */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.accent }, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={[styles.saveText, { color: theme.accentInk }]}>{saving ? 'Opslaan…' : 'Opslaan'}</Text>
            <Text style={[styles.saveText, { color: theme.accentInk }]}>→</Text>
          </TouchableOpacity>

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </PageContainer>
    </View>
  )
}

const styles = StyleSheet.create({
  root:        { flex: 1 },

  header:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingTop: 6, paddingBottom: 10 },
  squareBtn:   { width: 32, height: 32, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  squareBtnText:{ fontFamily: Fonts.displaySemiBold, fontSize: 17, lineHeight: 20 },
  headMid:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headBar:     { width: 4, height: 28, borderRadius: 2 },
  headTitle:   { flex: 1, fontFamily: Fonts.displayBold, fontSize: 17, letterSpacing: -0.3 },
  deleteLink:  { fontFamily: Fonts.displaySemiBold, fontSize: 13 },

  scroll:      { paddingHorizontal: Spacing.lg, paddingTop: 4 },
  section:     { marginBottom: Spacing.lg },
  paceRow:     { flexDirection: 'row', gap: 10, marginBottom: Spacing.lg },
  intervalsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  intervalsChevron: { fontFamily: Fonts.display, fontSize: 17 },
  intervalsChevronOpen: { transform: [{ rotate: '90deg' }] },

  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 16, borderRadius: Radius.lg, marginTop: 4 },
  saveText:    { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.1 },
})
