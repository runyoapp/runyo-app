import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
import { Toast } from '@/components/shared/Toast'
import { signInWithGoogle } from '@/services/auth'
import { updateActivity } from '@/services/sheets'
import { toDateString, dateFromOffset, addDays, formatDayLabel } from '@/utils/date'
import { LightTheme, Fonts, Spacing } from '@/constants/theme'

const EMOJIS = ['😵', '😓', '😐', '💪', '🔥']

function buildFeedbackString(rating: number, text: string): string {
  return `${rating}/5 ${EMOJIS[rating - 1]}${text ? ` – ${text}` : ''}`
}

export function TodayScreen() {
  const insets = useSafeAreaInsets()

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

  const [signingIn, setSigningIn] = useState(false)

  async function handleSignIn() {
    setSigningIn(true)
    try {
      const ts = await signInWithGoogle()
      setTokenSet(ts)
    } catch (e: any) {
      if (e?.message !== 'Auth cancelled') showToast('Inloggen mislukt, probeer opnieuw.')
    } finally {
      setSigningIn(false)
    }
  }

  // Data
  const { isLoading, refetch } = useActivities()

  // Local UI state
  const [editingFeedback, setEditingFeedback] = useState(false)

  // Derived
  const isSignedIn   = !!tokenSet
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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>runyo</Text>
        {isSignedIn ? (
          <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
            <Text style={styles.refreshIcon}>↻</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={handleSignIn}
            disabled={signingIn}
          >
            <Text style={styles.signInBtnText}>{signingIn ? '…' : 'Inloggen'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
            onConnect={() => isSignedIn ? null : promptAsync()}
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
                onPress={() => {}}
                onFeedbackPress={() => setEditingFeedback(true)}
              />
            ))}

            {/* Feedback */}
            {fbRow && (fbRow.feedback && !editingFeedback ? (
              <FeedbackDisplay
                feedback={fbRow.feedback}
                onEdit={() => setEditingFeedback(true)}
              />
            ) : (editingFeedback || !fbRow.feedback) && fbRow.type === 'run' && (
              <FeedbackSection
                existing={fbRow.feedback}
                onSubmit={handleFeedback}
                onCancel={fbRow.feedback ? () => setEditingFeedback(false) : undefined}
              />
            ))}
          </>
        )}

        {/* Tomorrow card */}
        {tmrRow && (
          <TomorrowCard
            activity={tmrRow}
            onPress={() => setDayOffset(1)}
          />
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      <Toast />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LightTheme.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  logo: {
    fontFamily: Fonts.displayBold,
    fontSize: 22,
    color: LightTheme.text,
    letterSpacing: -0.5,
  },
  refreshBtn: {
    padding: Spacing.sm,
  },
  refreshIcon: {
    fontSize: 20,
    color: LightTheme.muted,
  },
  signInBtn: {
    backgroundColor: LightTheme.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
  },
  signInBtnText: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 13,
    color: '#fff',
  },
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
