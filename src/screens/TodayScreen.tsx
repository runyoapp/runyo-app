import { useState } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useSwipeAnimation } from '@/hooks/useSwipeAnimation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useActivities } from '@/hooks/useActivities'
import { useTodayData } from '@/hooks/useTodayData'
import { useDaySwipe } from '@/hooks/useDaySwipe'
import { DayStrip } from '@/components/today/DayStrip'
import { HeroCard, RestCard, NoSchemaCard } from '@/components/today/HeroCard'
import { TomorrowCard } from '@/components/today/TomorrowCard'
import { FeedbackSection, FeedbackDisplay } from '@/components/today/FeedbackSection'
import { WeatherWidget } from '@/components/today/WeatherWidget'
import { AppHeader } from '@/components/shared/AppHeader'
import { Toast } from '@/components/shared/Toast'
import { DayDetailModal } from '@/screens/DayDetailModal'
import { AddActivityModal } from '@/screens/AddActivityModal'
import { ImportModal } from '@/screens/ImportModal'
import { RaceModal } from '@/screens/RaceModal'
import { updateActivity } from '@/services/sheets'
import { patchActivity } from '@/services/activities'
import { LightTheme, Fonts, Spacing } from '@/constants/theme'
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
  const getToken    = useAuthStore(s => s.getToken)
  const showToast      = useUiStore(s => s.showToast)
  const openLoginSheet = useUiStore(s => s.openLoginSheet)
  const theme       = useTheme()

  const {
    isSignedIn, dateStr, dayLabel, dayOffset, setDayOffset,
    sheetId, tabName, sheetTabId, schemaId,
    upsertActivity, activities,
    activeRows, isRest, fbRow, tmrRow,
  } = useTodayData()

  const { isLoading } = useActivities()
  const swipeAnim     = useSwipeAnimation(dayOffset)
  const panHandlers   = useDaySwipe(dayOffset, setDayOffset)

  const [editingFeedback,  setEditingFeedback]  = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [raceActivity,     setRaceActivity]     = useState<Activity | null>(null)
  const [addModalOpen,     setAddModalOpen]     = useState(false)
  const [importOpen,       setImportOpen]       = useState(false)

  async function handleFeedback(rating: number, text: string) {
    if (!fbRow) return
    const isSheetsRow = !!fbRow.rowIndex
    if (isSheetsRow && (!sheetId || !sheetTabId)) return
    if (!isSheetsRow && !schemaId) return
    const feedback = buildFeedbackString(rating, text)
    try {
      if (isSheetsRow) {
        const token = await getToken()
        if (!token) return
        await updateActivity(sheetId!, tabName, token, fbRow.rowIndex!, { feedback })
        upsertActivity({ ...fbRow, feedback })
        await queryClient.invalidateQueries({ queryKey: ['activities', 'sheets', sheetId, tabName] })
      } else {
        const updated = await patchActivity(schemaId!, fbRow.id, { /* feedback not in ActivityPatchInput yet */ } as any)
        // feedback field not in backend schema yet — optimistic update only
        upsertActivity({ ...fbRow, feedback })
        void updated  // remove when backend supports feedback
        await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      }
      setEditingFeedback(false)
      showToast('Beoordeling opgeslagen!')
    } catch {
      showToast('Opslaan mislukt, probeer opnieuw.')
    }
  }

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

      <Animated.ScrollView
        style={[styles.scroll, swipeAnim.style]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        {...panHandlers}
      >
        <DayStrip
          dayOffset={dayOffset}
          activities={activities}
          onSelectDay={setDayOffset}
          onPrevWeek={() => setDayOffset(dayOffset - 7)}
          onNextWeek={() => setDayOffset(dayOffset + 7)}
        />

        <View style={styles.kickerRow}>
          <Text style={styles.kicker}>{dayLabel}</Text>
        </View>

        {dayOffset === 0 && <WeatherWidget />}

        {!sheetId && !schemaId ? (
          <NoSchemaCard
            isSignedIn={isSignedIn}
            onConnect={() => setImportOpen(true)}
            onLogin={openLoginSheet}
          />
        ) : isLoading ? (
          <View style={styles.loadingRow}>
            <Text style={styles.loadingText}>Laden…</Text>
          </View>
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

            {fbRow && fbRow.feedback && !editingFeedback && (
              <FeedbackDisplay
                feedback={fbRow.feedback}
                onEdit={() => setEditingFeedback(true)}
              />
            )}
            {fbRow && editingFeedback && (
              <FeedbackSection
                existing={fbRow.feedback}
                onSubmit={handleFeedback}
                onCancel={() => setEditingFeedback(false)}
              />
            )}
          </>
        )}

        {tmrRow && (
          <TomorrowCard activity={tmrRow} onPress={() => setDayOffset(1)} />
        )}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>
      </PageContainer>

      <Toast />
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
      <ImportModal
        visible={importOpen}
        onClose={() => setImportOpen(false)}
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
})
