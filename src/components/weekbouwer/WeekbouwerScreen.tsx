import { useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { createActivitiesBatch, type ActivityCreateInput } from '@/services/activities'
import { PageContainer } from '@/components/shared/PageContainer'
import { AddActivityModal } from '@/screens/AddActivityModal'
import { ActivityActionSheet } from '@/components/weekbouwer/ActivityActionSheet'
import { BlokOverzicht } from '@/components/weekbouwer/BlokOverzicht'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import { activityColor, volumeCategory, categoryLabel, categoryColor } from '@/utils/runCategory'
import {
  DAYS_NL, MONTHS_NL, fromDateString, addDays, toDateString,
} from '@/utils/date'
import type { PlanWeekData } from '@/components/plan/PlanWeek'
import type { Activity } from '@/types/activity'

type Props = {
  weekMonday: string
  weeks: PlanWeekData[]      // alle weken (num/range/goalKm) voor identificatie + blok-overzicht
  onBack: () => void
  onEditActivity: (activity: Activity) => void
  onJumpToWeek: (monday: string) => void
}

type DayCell = {
  datum: string
  label: string
  dayNum: number
  isToday: boolean
  activities: Activity[]
}

function weekRange(monday: string): string {
  const d0 = fromDateString(monday)
  const d6 = addDays(d0, 6)
  const m0 = MONTHS_NL[d0.getMonth()]
  const m6 = MONTHS_NL[d6.getMonth()]
  return m0 === m6
    ? `${d0.getDate()} - ${d6.getDate()} ${m6}`
    : `${d0.getDate()} ${m0} - ${d6.getDate()} ${m6}`
}

export function WeekbouwerScreen({ weekMonday, weeks, onBack, onEditActivity, onJumpToWeek }: Props) {
  const theme          = useTheme()
  const insets         = useSafeAreaInsets()
  const allActivities  = useDataStore(s => s.activities)
  const schemaId       = useDataStore(s => s.schemaId)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const showToast      = useUiStore(s => s.showToast)
  const queryClient    = useQueryClient()

  const [sheetActivity, setSheetActivity] = useState<Activity | null>(null)
  const [addOpen, setAddOpen]             = useState(false)
  const [overzichtOpen, setOverzichtOpen] = useState(false)
  const [copying, setCopying]             = useState(false)

  const today = useMemo(() => toDateString(new Date()), [])
  const sunday = useMemo(() => toDateString(addDays(fromDateString(weekMonday), 6)), [weekMonday])

  const weekMeta = useMemo(() => weeks.find(w => w.monday === weekMonday), [weeks, weekMonday])

  // Dagen live afgeleid uit de store (geen snapshot) zodat optimistic updates
  // meteen zichtbaar zijn. Werk-items tellen niet mee in de weekbouwer.
  const days = useMemo<DayCell[]>(() => {
    const mon = fromDateString(weekMonday)
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(mon, i)
      const datum = toDateString(d)
      const acts = allActivities
        .filter(a => a.datum === datum && a.type !== 'work')
        .sort((x, y) => x.id.localeCompare(y.id))
      return {
        datum,
        label: DAYS_NL[i],
        dayNum: d.getDate(),
        isToday: datum === today,
        activities: acts,
      }
    })
  }, [allActivities, weekMonday, today])

  // Trainingsactiviteiten van de week (zonder rust) — basis voor km + kopie.
  const sessions = useMemo(
    () => days.flatMap(d => d.activities).filter(a => a.type !== 'rest'),
    [days],
  )

  const planKm = useMemo(
    () => Math.round(sessions.reduce((s, a) => s + (a.km ?? 0), 0)),
    [sessions],
  )

  // Volume per categorie (run-subcategorie of type), alleen km > 0.
  const segments = useMemo(() => {
    const totals = new Map<string, number>()
    for (const a of sessions) {
      const km = a.km ?? 0
      if (km <= 0) continue
      const key = volumeCategory(a)
      totals.set(key, (totals.get(key) ?? 0) + km)
    }
    return [...totals.entries()]
      .map(([key, km]) => ({ key, km: Math.round(km) }))
      .sort((a, b) => b.km - a.km)
  }, [sessions])

  const segSum = segments.reduce((s, x) => s + x.km, 0) || 1

  const firstEmptyDatum = useMemo(
    () => days.find(d => d.activities.length === 0)?.datum ?? weekMonday,
    [days, weekMonday],
  )

  async function handleCopyWeek() {
    if (!schemaId || copying) return
    if (!sessions.length) {
      showToast('Geen activiteiten om te kopiëren')
      return
    }
    setCopying(true)
    const inputs: ActivityCreateInput[] = sessions.map(a => ({
      datum: toDateString(addDays(fromDateString(a.datum), 7)),
      type: a.type,
      titel: a.titel || null,
      detail: a.detail || null,
      km: a.km,
      targetPace: a.targetPace,
      targetHr: a.targetHr,
      intervals: a.intervals,
    }))
    try {
      const created = await createActivitiesBatch(schemaId, inputs)
      created.forEach(upsertActivity)
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast(`Week gekopieerd naar volgende week`)
    } catch {
      showToast('Kopiëren mislukt, probeer opnieuw.')
    } finally {
      setCopying(false)
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <PageContainer>
        {/* Terug-header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headLeft} onPress={onBack} activeOpacity={0.7}>
            <View style={[styles.squareBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.squareBtnText, { color: theme.text }]}>‹</Text>
            </View>
            <View>
              <Text style={[styles.headTitle, { color: theme.text }]}>
                Week {weekMeta?.num ?? '—'}
              </Text>
              <Text style={[styles.headRange, { color: theme.muted }]}>{weekRange(weekMonday)}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.squareBtn, { backgroundColor: theme.text }]}
            onPress={() => setAddOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.squareBtnText, { color: theme.bg }]}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Week-opbouw header */}
        <View style={[styles.buildHead, { borderBottomColor: theme.border }]}>
          <View style={styles.buildTopRow}>
            <TouchableOpacity
              style={styles.buildPillRow}
              onPress={() => setOverzichtOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.buildLabel, { color: theme.muted }]}>week-opbouw</Text>
              <View style={[styles.blokPill, { backgroundColor: theme.accentGlow, borderColor: theme.accent }]}>
                <Text style={[styles.blokPillText, { color: theme.accent }]}>toon blok ↑</Text>
              </View>
            </TouchableOpacity>
            <Text style={[styles.buildKm, { color: theme.text }]}>{planKm} km</Text>
          </View>

          <View style={styles.volTrack}>
            {segments.map(seg => (
              <View
                key={seg.key}
                style={{
                  flex: seg.km / segSum,
                  backgroundColor: categoryColor(seg.key, theme),
                  borderRadius: 999,
                }}
              />
            ))}
            {!segments.length && <View style={[styles.volEmpty, { backgroundColor: theme.border }]} />}
          </View>

          <View style={styles.legend}>
            {segments.map(seg => (
              <View key={seg.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: categoryColor(seg.key, theme) }]} />
                <Text style={[styles.legendText, { color: theme.muted }]}>
                  {categoryLabel(seg.key)} {seg.km}km
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.surface, borderColor: theme.border }, copying && { opacity: 0.5 }]}
            onPress={handleCopyWeek}
            activeOpacity={0.8}
            disabled={copying}
          >
            <Text style={[styles.actionBtnText, { color: theme.text2 }]}>
              {copying ? 'Kopiëren…' : 'Kopieer week'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dagenlijst */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.daysScroll}
        >
          {days.map(day => (
            <View key={day.datum} style={styles.dayGroup}>
              <View style={styles.dayHead}>
                <Text style={[styles.dayName, { color: day.isToday ? theme.accent : theme.muted }]}>
                  {day.label.toUpperCase()}
                </Text>
                <Text style={[styles.dayNum, {
                  color: day.isToday ? theme.text : theme.text2,
                  fontFamily: day.isToday ? Fonts.displayBold : Fonts.displaySemiBold,
                }]}>
                  {day.dayNum}
                </Text>
                {day.isToday && (
                  <Text style={[styles.todayBadge, { color: theme.accent }]}>vandaag</Text>
                )}
              </View>

              <View style={styles.dayBody}>
                {day.activities.length > 0 ? (
                  day.activities.map(a => (
                    <ActivityCard
                      key={a.id}
                      activity={a}
                      isToday={day.isToday}
                      onPress={() => setSheetActivity(a)}
                    />
                  ))
                ) : (
                  <View style={[styles.restRow, { borderColor: theme.border }]}>
                    <Text style={[styles.restText, { color: theme.muted }]}>rustdag</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </PageContainer>

      <ActivityActionSheet
        activity={sheetActivity}
        weekMonday={weekMonday}
        onClose={() => setSheetActivity(null)}
        onEdit={(a) => { setSheetActivity(null); onEditActivity(a) }}
      />

      <BlokOverzicht
        visible={overzichtOpen}
        weeks={weeks}
        activeMonday={weekMonday}
        onClose={() => setOverzichtOpen(false)}
        onPickWeek={(monday) => { setOverzichtOpen(false); onJumpToWeek(monday) }}
      />

      <AddActivityModal
        visible={addOpen}
        prefillDate={firstEmptyDatum}
        onClose={() => setAddOpen(false)}
      />
    </View>
  )
}

// Detail-tekst van een activiteit: km of duur uit detail.
function activitySub(activity: Activity): string {
  if (activity.detail) return activity.detail
  if (activity.targetPace) return `${activity.targetPace}/km`
  return ''
}

function activityMeta(activity: Activity): string {
  if (activity.km != null && activity.km > 0) return `${activity.km} km`
  const min = activity.detail?.match(/(\d+)\s*min/i)
  return min ? `${min[1]} min` : ''
}

function ActivityCard({ activity, isToday, onPress }: {
  activity: Activity
  isToday: boolean
  onPress: () => void
}) {
  const theme = useTheme()
  const sub = activitySub(activity)
  const meta = activityMeta(activity)
  const done = activity.feedback != null

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: isToday ? theme.accent : theme.border,
        },
        isToday && { shadowColor: theme.accent, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
      ]}
    >
      <View style={[styles.cardBar, { backgroundColor: activityColor(activity, theme) }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
            {activity.titel || activity.type}
          </Text>
          {!!meta && <Text style={[styles.cardMeta, { color: theme.muted }]}>{meta}</Text>}
        </View>
        {!!sub && <Text style={[styles.cardSub, { color: theme.muted }]} numberOfLines={1}>{sub}</Text>}
      </View>
      {done && (
        <View style={[styles.cardDone, { backgroundColor: theme.accentGlow }]}>
          <Text style={[styles.cardDoneText, { color: theme.accent }]}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  root:        { flex: 1 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: 6, paddingBottom: 10 },
  headLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  squareBtn:   { width: 32, height: 32, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  squareBtnText:{ fontFamily: Fonts.displaySemiBold, fontSize: 17, lineHeight: 20 },
  headTitle:   { fontFamily: Fonts.displayBold, fontSize: 17, letterSpacing: -0.3 },
  headRange:   { fontFamily: Fonts.display, fontSize: 12, marginTop: 1 },

  buildHead:   { paddingHorizontal: Spacing.lg, paddingBottom: 12, borderBottomWidth: 1 },
  buildTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  buildPillRow:{ flexDirection: 'row', alignItems: 'center', gap: 7 },
  buildLabel:  { fontFamily: Fonts.display, fontSize: 12.5 },
  blokPill:    { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  blokPillText:{ fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 0.3 },
  buildKm:     { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.3 },

  volTrack:    { flexDirection: 'row', height: 6, borderRadius: 999, overflow: 'hidden', gap: 2 },
  volEmpty:    { flex: 1, borderRadius: 999 },
  legend:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 7 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:   { width: 7, height: 7, borderRadius: 999 },
  legendText:  { fontFamily: Fonts.display, fontSize: 11 },

  actionRow:   { flexDirection: 'row', gap: 7, paddingHorizontal: Spacing.lg, paddingTop: 8, paddingBottom: 4 },
  actionBtn:   { flex: 1, borderWidth: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  actionBtnText:{ fontFamily: Fonts.displaySemiBold, fontSize: 12.5 },

  daysScroll:  { paddingHorizontal: Spacing.md, paddingTop: 10 },
  dayGroup:    { marginBottom: 12 },
  dayHead:     { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6, paddingHorizontal: 4 },
  dayName:     { fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 0.4, minWidth: 22 },
  dayNum:      { fontSize: 15, letterSpacing: -0.3 },
  todayBadge:  { fontFamily: Fonts.displaySemiBold, fontSize: 10.5 },
  dayBody:     { gap: 6 },

  card:        { flexDirection: 'row', alignItems: 'stretch', borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  cardBar:     { width: 4 },
  cardBody:    { flex: 1, paddingVertical: 11, paddingLeft: 13, paddingRight: 12, minWidth: 0 },
  cardTopRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle:   { flex: 1, fontFamily: Fonts.displaySemiBold, fontSize: 14, letterSpacing: -0.1 },
  cardMeta:    { fontFamily: Fonts.mono, fontSize: 12 },
  cardSub:     { fontFamily: Fonts.display, fontSize: 12, marginTop: 2 },
  cardDone:    { width: 36, alignItems: 'center', justifyContent: 'center' },
  cardDoneText:{ fontSize: 14 },

  restRow:     { height: 32, borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.md, justifyContent: 'center', paddingLeft: 14 },
  restText:    { fontFamily: Fonts.display, fontSize: 12 },
})
