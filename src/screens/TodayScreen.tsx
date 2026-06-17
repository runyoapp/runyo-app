import { useState } from 'react'
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useSwipeAnimation, useDayStripAnimation } from '@/hooks/useSwipeAnimation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUiStore } from '@/stores/uiStore'
import { useActivities } from '@/hooks/useActivities'
import { useTodayData } from '@/hooks/useTodayData'
import { useDaySwipe } from '@/hooks/useDaySwipe'
import { DayStrip } from '@/components/today/DayStrip'
import { HeroCard, RestCard, WorkCard, NoSchemaCard } from '@/components/today/HeroCard'
import { TomorrowCard } from '@/components/today/TomorrowCard'
import { RescheduleWeek } from '@/components/today/RescheduleWeek'
import { FeedbackSection } from '@/components/today/FeedbackSection'
import { WeatherWidget } from '@/components/today/WeatherWidget'
import { AppHeader } from '@/components/shared/AppHeader'
import { DayDetailModal } from '@/screens/DayDetailModal'
import { AddActivityModal } from '@/screens/AddActivityModal'
import { ImportWizard } from '@/screens/import/ImportWizard'
import { RaceModal } from '@/screens/RaceModal'
import { patchActivity } from '@/services/activities'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { PageContainer } from '@/components/shared/PageContainer'
import type { Activity } from '@/types/activity'

const EMOJIS = ['😵', '😓', '😐', '💪', '🔥']

function buildFeedbackString(rating: number, text: string): string {
  return `${rating}/5 ${EMOJIS[rating - 1]}${text ? ` – ${text}` : ''}`
}

export function TodayScreen() {
  const insets      = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const showToast      = useUiStore(s => s.showToast)
  const openLoginSheet = useUiStore(s => s.openLoginSheet)
  const theme       = useTheme()

  const {
    isSignedIn, dateStr, dayLabel, dayOffset, setDayOffset,
    schemaId,
    upsertActivity, activities,
    activeRows, isRest, isWork, fbRow, tmrRow,
  } = useTodayData()

  const { isLoading }  = useActivities()
  const swipeAnim      = useSwipeAnimation(dayOffset)
  const stripAnim      = useDayStripAnimation(dayOffset)
  const panHandlers    = useDaySwipe(dayOffset, setDayOffset)

  const [editingFeedback,  setEditingFeedback]  = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [raceActivity,     setRaceActivity]     = useState<Activity | null>(null)
  const [addModalOpen,     setAddModalOpen]     = useState(false)
  const [importOpen,       setImportOpen]       = useState(false)

  async function handleFeedback(rating: number, text: string) {
    if (!fbRow) return
    if (!schemaId) return
    const feedback = buildFeedbackString(rating, text)
    try {
      upsertActivity({ ...fbRow, feedback, rating })
      await patchActivity(schemaId, fbRow.id, { feedback, rating })
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      setEditingFeedback(false)
      showToast('Beoordeling opgeslagen!')
    } catch {
      showToast('Opslaan mislukt, probeer opnieuw.')
    }
  }

  const isOffToday = dayOffset !== 0

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <PageContainer>
      <AppHeader
        onAddPress={() => setAddModalOpen(true)}
        onRacePress={datum => {
          const race = activities.find(a => a.datum === datum && a.type === 'race')
          if (race) setRaceActivity(race)
        }}
      />

      {/* U40: DayStrip statisch, animeert alleen bij week-grens */}
      <Animated.View style={stripAnim.style}>
        <DayStrip
          dayOffset={dayOffset}
          activities={activities}
          onSelectDay={setDayOffset}
          onPrevWeek={() => setDayOffset(dayOffset - 7)}
          onNextWeek={() => setDayOffset(dayOffset + 7)}
        />
      </Animated.View>

      {/* U40: alleen tab-inhoud animeert bij elke dag-wissel */}
      <Animated.ScrollView
        style={[styles.scroll, swipeAnim.style]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        {...panHandlers}
      >
        <View style={styles.kickerRow}>
          <Text style={styles.kicker}>{dayLabel}</Text>
        </View>

        {dayOffset === 0 && <WeatherWidget />}

        {!schemaId ? (
          <NoSchemaCard
            isSignedIn={isSignedIn}
            onConnect={() => setImportOpen(true)}
            onLogin={openLoginSheet}
          />
        ) : isLoading ? (
          <View style={styles.loadingRow}>
            <Text style={styles.loadingText}>Laden…</Text>
          </View>
        ) : isWork ? (
          <WorkCard />
        ) : isRest ? (
          <RestCard />
        ) : (
          <>
            {activeRows.map(row => (
              <HeroCard
                key={row.id}
                activity={row}
                onPress={() => row.type === 'race' ? setRaceActivity(row) : setSelectedActivity(row)}
                onFeedbackPress={() => setEditingFeedback(v => !v)}
              />
            ))}

            {fbRow && editingFeedback && (
              <FeedbackSection
                existing={fbRow.feedback}
                onSubmit={handleFeedback}
                onCancel={() => setEditingFeedback(false)}
              />
            )}
          </>
        )}

        {/* "Deze week" reschedule-strip: alleen op vandaag (week is relatief
            t.o.v. nu) en als er een schema gekoppeld is. */}
        {dayOffset === 0 && schemaId && !isLoading && (
          <RescheduleWeek activities={activities} />
        )}

        {tmrRow && (
          <TomorrowCard activity={tmrRow} onPress={() => setDayOffset(1)} />
        )}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* U42: 'Vandaag'-knop zodra gebruiker weggeswiped is */}
      {isOffToday && (
        <TouchableOpacity
          style={[styles.todayBtn, { backgroundColor: theme.accent }]}
          onPress={() => setDayOffset(0)}
          activeOpacity={0.85}
        >
          <Text style={[styles.todayBtnText, { color: theme.accentInk }]}>← Vandaag</Text>
        </TouchableOpacity>
      )}
      </PageContainer>

      <DayDetailModal
        activity={selectedActivity}
        visible={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
      <AddActivityModal
        visible={addModalOpen}
        prefillDate={dateStr}
        onClose={() => setAddModalOpen(false)}
      />
      <RaceModal
        activity={raceActivity}
        visible={!!raceActivity}
        onClose={() => setRaceActivity(null)}
      />
      <ImportWizard
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => setImportOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: LightTheme.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },
  kickerRow:     { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  kicker:        { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: LightTheme.text2 },
  loadingRow:    { padding: Spacing.xl, alignItems: 'center' },
  loadingText:   { fontFamily: Fonts.mono, fontSize: 13, color: LightTheme.muted },
  todayBtn:      {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    shadowColor: '#0E1F1A',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  todayBtnText:  { fontFamily: Fonts.displayBold, fontSize: 14, letterSpacing: -0.2 },
})
