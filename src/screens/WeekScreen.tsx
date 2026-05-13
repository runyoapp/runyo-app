import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { useActivities } from '@/hooks/useActivities'
import { WeekDayRow } from '@/components/week/WeekDayRow'
import { updateActivity } from '@/services/sheets'
import {
  getWeekDates, getISOWeekNumber, fromDateString, toDateString,
  MONTHS_NL, DAYS_NL, mondayIndex,
} from '@/utils/date'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import type { Activity } from '@/types/activity'

export function WeekScreen() {
  const insets = useSafeAreaInsets()

  const getToken  = useAuthStore(s => s.getToken)
  const { weekOffset, setWeekOffset, activities, sheetId, tabName, upsertActivity } = useDataStore(
    useShallow(s => ({
      weekOffset:     s.weekOffset,
      setWeekOffset:  s.setWeekOffset,
      activities:     s.activities,
      sheetId:        s.sheetId,
      tabName:        s.tabName,
      upsertActivity: s.upsertActivity,
    }))
  )
  const showToast = useUiStore(s => s.showToast)
  useActivities()

  const todayStr  = toDateString(new Date())
  const weekDates = getWeekDates(weekOffset)
  const d0        = fromDateString(weekDates[0])
  const d6        = fromDateString(weekDates[6])
  const weekNum   = getISOWeekNumber(d0)
  const weekLabel = `${d0.getDate()}–${d6.getDate()} ${MONTHS_NL[d0.getMonth()]}`

  const weekData = weekDates.map(date => ({
    date,
    rows: activities.filter(a => a.datum === date && a.type !== 'work' && a.type !== 'rest'),
  })).filter(d => d.rows.length > 0)

  const plannedKm = weekData.reduce((s, d) => s + d.rows.reduce((a, r) => a + (r.km ?? 0), 0), 0)
  const doneKm    = weekData
    .filter(d => d.date <= todayStr)
    .reduce((s, d) => s + d.rows.reduce((a, r) => a + (r.km ?? 0), 0), 0)
  const pct    = plannedKm > 0 ? Math.min(100, Math.round(doneKm / plannedKm * 100)) : 0
  const kmLeft = Math.max(0, plannedKm - doneKm)

  async function doReschedule(activity: Activity, newDate: string) {
    if (!sheetId || newDate === activity.datum) return
    const token = await getToken()
    if (!token) return
    showToast('Verplaatsen…')
    try {
      await updateActivity(sheetId, tabName, token, (activity as any).rowIndex ?? 2, { datum: newDate })
      upsertActivity({ ...activity, datum: newDate })
      const mn = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
      showToast(`✓ Verplaatst naar ${newDate.slice(8)} ${mn[parseInt(newDate.slice(5, 7)) - 1]}`)
    } catch {
      showToast('❌ Verplaatsen mislukt')
    }
  }

  function handleLongPress(activity: Activity) {
    const options = weekDates
      .filter(d => d !== activity.datum)
      .map(d => {
        const date = fromDateString(d)
        return `${DAYS_NL[mondayIndex(date)]} ${date.getDate()}`
      })

    Alert.alert(
      'Verplaatsen naar…',
      activity.titel ?? activity.type,
      [
        ...weekDates
          .filter(d => d !== activity.datum)
          .map((d, i) => ({
            text: options[i],
            onPress: () => doReschedule(activity, d),
          })),
        { text: 'Annuleren', style: 'cancel' },
      ]
    )
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setWeekOffset(weekOffset - 1)} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.weekNum}>Week {weekNum}</Text>
          <Text style={styles.weekDates}>
            {weekLabel}
            {weekOffset !== 0 && (
              <Text onPress={() => setWeekOffset(0)} style={styles.nowBtn}> · Nu</Text>
            )}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setWeekOffset(weekOffset + 1)} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.kmBlock}>
          <Text style={styles.kmTotal}>
            {doneKm.toFixed(0)}<Text style={styles.kmSlash}> / {plannedKm.toFixed(0)} km</Text>
          </Text>
          <Text style={styles.kmPct}>
            {pct}%{kmLeft > 0 ? ` · ${kmLeft.toFixed(0)} km te gaan` : ''}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>

      {/* Day strip */}
      <View style={styles.strip}>
        {weekDates.map((date, i) => {
          const d       = fromDateString(date)
          const isToday = date === todayStr
          const hasAct  = activities.some(a => a.datum === date && a.type !== 'rest' && a.type !== 'work')
          return (
            <View key={date} style={[styles.stripDay, isToday && styles.stripDayToday]}>
              <Text style={[styles.stripDayName, isToday && styles.stripTextActive]}>{DAYS_NL[i]}</Text>
              <Text style={[styles.stripDayNum,  isToday && styles.stripTextActive]}>{d.getDate()}</Text>
              <View style={[
                styles.stripDot,
                { backgroundColor: hasAct ? (isToday ? 'rgba(255,255,255,0.7)' : LightTheme.accent) : 'transparent' },
              ]} />
            </View>
          )
        })}
      </View>

      {/* Rows */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {weekData.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {sheetId ? 'Geen trainingen deze week.' : 'Koppel een schema in Instellingen.'}
            </Text>
          </View>
        ) : (
          weekData.map(({ date, rows }) =>
            rows.map(activity => (
              <WeekDayRow
                key={activity.id}
                activity={activity}
                isToday={date === todayStr}
                isPast={date < todayStr}
                onPress={() => {}}
                onLongPress={handleLongPress}
              />
            ))
          )
        )}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: LightTheme.bg },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.md },
  navBtn:          { width: 36, alignItems: 'center' },
  navArrow:        { fontFamily: Fonts.display, fontSize: 24, color: LightTheme.muted },
  headerCenter:    { flex: 1, alignItems: 'center' },
  weekNum:         { fontFamily: Fonts.displayBold, fontSize: 16, color: LightTheme.text },
  weekDates:       { fontFamily: Fonts.display, fontSize: 12, color: LightTheme.muted },
  nowBtn:          { color: LightTheme.accent },
  kmBlock:         { alignItems: 'flex-end' },
  kmTotal:         { fontFamily: Fonts.displaySemiBold, fontSize: 15, color: LightTheme.text },
  kmSlash:         { fontFamily: Fonts.display, fontSize: 13, color: LightTheme.muted },
  kmPct:           { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted },
  progressTrack:   { height: 3, backgroundColor: LightTheme.border, marginHorizontal: Spacing.lg, borderRadius: 2, marginBottom: Spacing.sm },
  progressFill:    { height: 3, backgroundColor: LightTheme.accent, borderRadius: 2 },
  strip:           { flexDirection: 'row', paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  stripDay:        { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.md, gap: 2 },
  stripDayToday:   { backgroundColor: LightTheme.accent },
  stripDayName:    { fontFamily: Fonts.displayMedium, fontSize: 10, color: LightTheme.muted },
  stripDayNum:     { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: LightTheme.text },
  stripTextActive: { color: '#fff' },
  stripDot:        { width: 4, height: 4, borderRadius: 2 },
  scroll:          { flex: 1 },
  scrollContent:   { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs },
  emptyState:      { paddingTop: Spacing.xxl, alignItems: 'center' },
  emptyText:       { fontFamily: Fonts.mono, fontSize: 13, color: LightTheme.muted },
})
