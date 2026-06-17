import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { ModalSheet } from '@/components/shared/ModalSheet'
import { RaceModal } from '@/screens/RaceModal'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { useTheme } from '@/hooks/useTheme'
import { patchActivity } from '@/services/activities'
import { FeedbackSection, FeedbackDisplay } from '@/components/today/FeedbackSection'
import { ActivityColors, Fonts, Spacing, Radius, type Theme } from '@/constants/theme'
import { fromDateString, MONTHS_FULL_NL, DAYS_NL, mondayIndex, raceCountdown } from '@/utils/date'
import { derivePace } from '@/utils/raceProgress'
import type { Activity } from '@/types/activity'

const EMOJIS = ['😵', '😓', '😐', '💪', '🔥']

function buildFeedbackString(rating: number, text: string): string {
  return `${rating}/5 ${EMOJIS[rating - 1]}${text ? ` – ${text}` : ''}`
}

type Props = {
  activity: Activity | null
  visible: boolean
  onClose: () => void
  startInFeedback?: boolean
}

function fmtKm(km: number): string {
  return km % 1 === 0 ? String(km) : km.toFixed(1).replace('.', ',')
}

function fmtFullDate(datum: string): string {
  const d = fromDateString(datum)
  if (isNaN(d.getTime())) return datum
  return `${DAYS_NL[mondayIndex(d)].toLowerCase()} ${d.getDate()} ${MONTHS_FULL_NL[d.getMonth()]} ${d.getFullYear()}`
}

// Race-detail (read-only) met aftelteller + tier + metrics. "Race bewerken ›"
// opent de RaceModal (het edit-formulier). Spec-patroon: DayDetailModal.
export function RaceDetailModal({ activity, visible, onClose, startInFeedback }: Props) {
  const theme = useTheme()
  const queryClient    = useQueryClient()
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const showToast      = useUiStore(s => s.showToast)
  const [editOpen, setEditOpen] = useState(false)
  const [editingFeedback, setEditingFeedback] = useState(false)

  // Bij (her)openen: spring direct in de beoordeel-modus als daarom gevraagd.
  useEffect(() => {
    if (visible) setEditingFeedback(startInFeedback ?? false)
  }, [visible, startInFeedback, activity?.id])

  // Live versie uit de store zodat de detail-weergave actueel blijft nadat het
  // edit-formulier de race heeft bijgewerkt (de prop is een snapshot).
  const live = useDataStore(s => s.activities.find(a => a.id === activity?.id))
  const race = live ?? activity

  async function handleFeedback(rating: number, text: string) {
    if (!race) return
    const feedback = buildFeedbackString(rating, text)
    try {
      upsertActivity({ ...race, feedback, rating })
      await patchActivity(race.schemaId, race.id, { feedback, rating })
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', race.schemaId] })
      setEditingFeedback(false)
      showToast('Beoordeling opgeslagen!')
    } catch {
      showToast('Opslaan mislukt, probeer opnieuw.')
    }
  }

  if (!race) return null

  const raceHex   = ActivityColors.race.text
  const cd        = raceCountdown(race.datum)
  const pace      = derivePace(race.goalTime, race.km)
  const isMain    = !!race.isMainGoal
  const todayStr  = new Date().toISOString().split('T')[0]
  const isPast    = race.datum <= todayStr

  return (
    <>
      <ModalSheet
        visible={visible && !editOpen}
        title={race.titel || 'Race'}
        subtitle={fmtFullDate(race.datum)}
        accentDot={raceHex}
        onClose={onClose}
      >
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: `${theme.accent}55` }]}>
          <View style={styles.tierRow}>
            <View style={[styles.tierBadge, {
              backgroundColor: isMain ? theme.accent : theme.surface2,
              borderColor: isMain ? theme.accent : theme.border,
            }]}>
              <Text style={[styles.tierText, { color: isMain ? '#fff' : theme.text2 }]}>{isMain ? 'A' : 'B'}</Text>
            </View>
            <Text style={[styles.tierLabel, { color: isMain ? theme.accent : theme.muted }]}>
              {isMain ? 'hoofddoel' : 'race'}
            </Text>
          </View>

          <View style={styles.cdRow}>
            <Text style={[styles.cdVal, { color: theme.text }]}>{cd.val}</Text>
            <Text style={[styles.cdUnit, { color: theme.muted }]}>{cd.unit}</Text>
          </View>

          <View style={styles.metrics}>
            {race.km != null && <Metric label="afstand" value={`${fmtKm(race.km)} km`} theme={theme} />}
            {!!race.raceType && <Metric label="type" value={race.raceType} theme={theme} />}
            {!!race.goalTime && (
              <Metric label="doeltijd" value={`${race.goalTime}${pace ? ` · ${pace}/km` : ''}`} theme={theme} />
            )}
          </View>

          {!!race.detail && (
            <Text style={[styles.detail, { color: theme.muted }]}>{race.detail}</Text>
          )}

          <TouchableOpacity style={[styles.editBtn, { borderTopColor: theme.border }]} onPress={() => setEditOpen(true)}>
            <Text style={[styles.editText, { color: theme.muted }]}>Race bewerken ›</Text>
          </TouchableOpacity>
        </View>

        {/* Beoordeling — alleen voor gelopen races (verleden/vandaag) */}
        {isPast && (
          <View style={styles.feedbackWrap}>
            {race.feedback && !editingFeedback && (
              <FeedbackDisplay feedback={race.feedback} onEdit={() => setEditingFeedback(true)} />
            )}
            {race.feedback && editingFeedback && (
              <FeedbackSection existing={race.feedback} onSubmit={handleFeedback} onCancel={() => setEditingFeedback(false)} />
            )}
            {!race.feedback && !editingFeedback && (
              <TouchableOpacity style={[styles.feedbackPrompt, { backgroundColor: theme.accentGlow }]} onPress={() => setEditingFeedback(true)}>
                <Text style={[styles.feedbackPromptText, { color: theme.accent }]}>Beoordeel deze race →</Text>
              </TouchableOpacity>
            )}
            {!race.feedback && editingFeedback && (
              <FeedbackSection existing={null} onSubmit={handleFeedback} onCancel={() => setEditingFeedback(false)} />
            )}
          </View>
        )}
      </ModalSheet>

      <RaceModal activity={race} visible={editOpen} onClose={() => setEditOpen(false)} />
    </>
  )
}

function Metric({ label, value, theme }: { label: string; value: string; theme: Theme }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.metricVal, { color: theme.text }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card:        { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  tierRow:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tierBadge:   { width: 18, height: 18, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tierText:    { fontFamily: Fonts.displayBold, fontSize: 10 },
  tierLabel:   { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  cdRow:       { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cdVal:       { fontFamily: Fonts.displayBold, fontSize: 44, letterSpacing: -1.8, lineHeight: 46 },
  cdUnit:      { fontFamily: Fonts.displaySemiBold, fontSize: 15, letterSpacing: -0.2 },
  metrics:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  metric:      { gap: 2 },
  metricLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  metricVal:   { fontFamily: Fonts.displayBold, fontSize: 16, letterSpacing: -0.3 },
  detail:      { fontFamily: Fonts.display, fontSize: 14, lineHeight: 20 },
  editBtn:     { paddingTop: Spacing.sm, borderTopWidth: 1, marginTop: 2 },
  editText:    { fontFamily: Fonts.displayMedium, fontSize: 13 },
  feedbackWrap:       { marginTop: Spacing.md },
  feedbackPrompt:     { borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center' },
  feedbackPromptText: { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.2 },
})
