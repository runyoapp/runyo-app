import { useState, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, PanResponder, Animated } from 'react-native'
import { useSwipeAnimation } from '@/hooks/useSwipeAnimation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'
import { useActivities } from '@/hooks/useActivities'
import { DayStrip } from '@/components/today/DayStrip'
import { HeroCard, RestCard, NoSchemaCard } from '@/components/today/HeroCard'
import { TomorrowCard } from '@/components/today/TomorrowCard'
import { FeedbackSection, FeedbackDisplay } from '@/components/today/FeedbackSection'
import { WeatherWidget } from '@/components/today/WeatherWidget'
import { AppHeader } from '@/components/shared/AppHeader'
import { Toast } from '@/components/shared/Toast'
import { DayDetailModal } from '@/screens/DayDetailModal'
import { AddActivityModal } from '@/screens/AddActivityModal'
import { RaceModal } from '@/screens/RaceModal'
import { updateActivity } from '@/services/sheets'
import { toDateString, dateFromOffset, addDays, formatDayLabel } from '@/utils/date'
import { LightTheme, Fonts, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import type { Activity } from '@/types/activity'

const EMOJIS = ['😵', '😓', '😐', '💪', '🔥']

function buildFeedbackString(rating: number, text: string): string {
  return `${rating}/5 ${EMOJIS[rating - 1]}${text ? ` – ${text}` : ''}`
}

export function TodayScreen() {
  const insets     = useSafeAreaInsets()
  // Stores
  const tokenSet    = useAuthStore(s => s.tokenSet)
  const setTokenSet = useAuthStore(s => s.setTokenSet)
  const getToken    = useAuthStore(s => s.getToken)
  const { dayOffset, setDayOffset, activities, sheetId, tabName, sheetTabId, upsertActivity } = useDataStore(
    useShallow(s => ({
      dayOffset:      s.dayOffset,
      setDayOffset:   s.setDayOffset,
      activities:     s.activities,
      sheetId:        s.sheetId,
      tabName:        s.tabName,
      sheetTabId:     s.sheetTabId,
      upsertActivity: s.upsertActivity,
    }))
  )
  const lang        = useSettingsStore(s => s.prefs.lang)
  const showToast   = useUiStore(s => s.showToast)
  const theme       = useTheme()


  // Data
  const { isLoading, refetch } = useActivities()

  // Local UI state
  const swipeAnim = useSwipeAnimation(dayOffset)
  const [editingFeedback,  setEditingFeedback]  = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [raceActivity,     setRaceActivity]     = useState<Activity | null>(null)
  const [addModalOpen,     setAddModalOpen]     = useState(false)

  const swipe = useRef({ x: 0 })
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 12,
    onPanResponderGrant: e => { swipe.current.x = e.nativeEvent.pageX },
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 50) setDayOffset(dayOffset + (g.dx < 0 ? 1 : -1))
    },
  })

  // Derived
  const isSignedIn = !!tokenSet
  const selectedDate = dateFromOffset(dayOffset)
  const dateStr      = toDateString(selectedDate)
  const dayLabel     = formatDayLabel(selectedDate, dayOffset, lang)

  const todayRows  = activities.filter(a => a.datum === dateStr)
  const activeRows = todayRows.filter(a => a.type !== 'rest')
  const mainRow    = activeRows[0] ?? todayRows[0] ?? null
  const isRest     = !mainRow || mainRow.type === 'rest'
  const fbRow      = activeRows.find(a => a.type !== 'work') ?? null

  const tmrDate = addDays(new Date(), 1)
  const tmrStr  = toDateString(tmrDate)
  const tmrRow  = dayOffset === 0
    ? activities.find(a => a.datum === tmrStr && a.type !== 'rest') ?? null
    : null

  async function handleFeedback(rating: number, text: string) {
    if (!fbRow || !sheetId || !sheetTabId) return
    const token = await getToken()
    if (!token) return
    const feedback = buildFeedbackString(rating, text)
    try {
      await updateActivity(sheetId, tabName, token, (fbRow as any).rowIndex ?? 2, { feedback })
      upsertActivity({ ...fbRow, feedback })
      setEditingFeedback(false)
      showToast('Beoordeling opgeslagen!')
    } catch {
      showToast('Opslaan mislukt, probeer opnieuw.')
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
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
        {...panResponder.panHandlers}
      >
        {/* Day strip — always visible */}
        <DayStrip
          dayOffset={dayOffset}
          activities={activities}
          onSelectDay={setDayOffset}
          onPrevWeek={() => setDayOffset(dayOffset - 7)}
          onNextWeek={() => setDayOffset(dayOffset + 7)}
        />

        {/* Day label */}
        <View style={styles.kickerRow}>
          <Text style={styles.kicker}>{dayLabel}</Text>
        </View>

        {/* Weather (today only) */}
        {dayOffset === 0 && <WeatherWidget />}

        {/* Main content */}
        {!sheetId ? (
          <NoSchemaCard
            isSignedIn={isSignedIn}
            onConnect={() => {}}
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
                onFeedbackPress={() => setEditingFeedback(true)}
              />
            ))}

            {/* Feedback — only show when explicitly opened */}
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

        {/* Tomorrow card */}
        {tmrRow && (
          <TomorrowCard
            activity={tmrRow}
            onPress={() => setDayOffset(1)}
          />
        )}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

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
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LightTheme.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },
  kickerRow: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  kicker: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 14,
    color: LightTheme.text2,
  },
  loadingRow: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: LightTheme.muted,
  },
})
