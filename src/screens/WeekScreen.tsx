import { useState, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native'
import { ImportSchemaTile } from '@/components/shared/ImportSchemaTile'
import { ImportModal } from '@/screens/ImportModal'
import { useQueryClient } from '@tanstack/react-query'
import { useSwipeAnimation } from '@/hooks/useSwipeAnimation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { useActivities } from '@/hooks/useActivities'
import { DayDetailModal } from '@/screens/DayDetailModal'
import { AddActivityModal } from '@/screens/AddActivityModal'
import { RaceModal } from '@/screens/RaceModal'
import { AppHeader } from '@/components/shared/AppHeader'
import { WeekDayRow } from '@/components/week/WeekDayRow'
import { patchActivity } from '@/services/activities'
import {
  getWeekDates, getISOWeekNumber, fromDateString, toDateString,
  MONTHS_NL, DAYS_NL,
} from '@/utils/date'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { PageContainer } from '@/components/shared/PageContainer'
import type { Activity } from '@/types/activity'

type CellRect = { x: number; y: number; width: number; height: number }

export function WeekScreen() {
  const insets      = useSafeAreaInsets()
  const queryClient = useQueryClient()

  const { weekOffset, setWeekOffset, activities, schemaId, upsertActivity } = useDataStore(
    useShallow(s => ({
      weekOffset:     s.weekOffset,
      setWeekOffset:  s.setWeekOffset,
      activities:     s.activities,
      schemaId:       s.schemaId,
      upsertActivity: s.upsertActivity,
    }))
  )
  const showToast = useUiStore(s => s.showToast)
  const theme     = useTheme()
  useActivities()

  const swipeAnim = useSwipeAnimation(weekOffset)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [raceActivity,     setRaceActivity]     = useState<Activity | null>(null)
  const [addModalOpen,     setAddModalOpen]     = useState(false)
  const [importOpen,       setImportOpen]       = useState(false)
  const todayStr  = toDateString(new Date())

  // Drag-to-day state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragPos,    setDragPos]    = useState<{ x: number; y: number } | null>(null)
  const [hoverDate,  setHoverDate]  = useState<string | null>(null)
  const draggingActivityRef = useRef<Activity | null>(null)
  const cellRectsRef        = useRef<Map<string, CellRect>>(new Map())
  const cellRefs            = useRef<Map<string, View | null>>(new Map())

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
    if (newDate === activity.datum) return
    if (!schemaId) return
    showToast('Verplaatsen…')
    try {
      const updated = await patchActivity(schemaId, activity.id, { datum: newDate })
      upsertActivity(updated)
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      const mn = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
      showToast(`✓ Verplaatst naar ${newDate.slice(8)} ${mn[parseInt(newDate.slice(5, 7)) - 1]}`)
    } catch {
      showToast('❌ Verplaatsen mislukt')
    }
  }

  const findHoveredDate = (pageX: number, pageY: number): string | null => {
    for (const [date, rect] of cellRectsRef.current) {
      if (pageX >= rect.x && pageX <= rect.x + rect.width &&
          pageY >= rect.y && pageY <= rect.y + rect.height) {
        return date
      }
    }
    return null
  }

  const handleDragStart = useCallback((activity: Activity, pageX: number, pageY: number) => {
    draggingActivityRef.current = activity
    setDraggingId(activity.id)
    setDragPos({ x: pageX, y: pageY })
    setHoverDate(null)
  }, [])

  const handleDragMove = useCallback((pageX: number, pageY: number) => {
    setDragPos({ x: pageX, y: pageY })
    const date = findHoveredDate(pageX, pageY)
    setHoverDate(date)
  }, [])

  const handleDragEnd = useCallback((pageX: number, pageY: number, cancelled: boolean) => {
    const activity = draggingActivityRef.current
    draggingActivityRef.current = null
    setDraggingId(null)
    setDragPos(null)
    setHoverDate(null)
    if (cancelled || !activity) return
    const date = findHoveredDate(pageX, pageY)
    if (date) void doReschedule(activity, date)
  }, [schemaId])

  const measureCell = (date: string) => {
    const ref = cellRefs.current.get(date)
    if (!ref) return
    ref.measureInWindow((x, y, width, height) => {
      cellRectsRef.current.set(date, { x, y, width, height })
    })
  }

  const draggingActivity = draggingActivityRef.current

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <PageContainer>
      <AppHeader onAddPress={() => setAddModalOpen(true)} />
      {/* Week nav header */}
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

      {/* Day strip — drop targets */}
      <View style={styles.strip}>
        {weekDates.map((date, i) => {
          const d         = fromDateString(date)
          const isToday   = date === todayStr
          const hasAct    = activities.some(a => a.datum === date && a.type !== 'rest' && a.type !== 'work')
          const isHovered = hoverDate === date && draggingId !== null
          return (
            <View
              key={date}
              ref={(r) => { cellRefs.current.set(date, r) }}
              onLayout={() => measureCell(date)}
              style={[
                styles.stripDay,
                isToday && styles.stripDayToday,
                isHovered && styles.stripDayHover,
              ]}
            >
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

      {/* Rows — ScrollView zonder animatie op de container zelf (transform op ScrollView
          blokkeert scroll op web). Swipe-animatie zit op de Animated.View binnenin. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!draggingId}
      >
        <Animated.View style={swipeAnim.style}>
          {weekData.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {schemaId ? 'Geen trainingen deze week.' : 'Geen schema gekoppeld.'}
              </Text>
              {!schemaId && <ImportSchemaTile onPress={() => setImportOpen(true)} />}
            </View>
          ) : (
            weekData.map(({ date, rows }) =>
              rows.map(activity => (
                <WeekDayRow
                  key={activity.id}
                  activity={activity}
                  isToday={date === todayStr}
                  isPast={date < todayStr}
                  isDragging={draggingId === activity.id}
                  onPress={() => activity.type === 'race' ? setRaceActivity(activity) : setSelectedActivity(activity)}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                />
              ))
            )
          )}
        </Animated.View>
        <View style={{ height: 100 }} />
      </ScrollView>
      </PageContainer>

      {/* Ghost — rendered above everything during drag */}
      {draggingActivity && dragPos && (
        <View
          pointerEvents="none"
          style={[
            styles.ghost,
            { left: dragPos.x - 80, top: dragPos.y - 24, backgroundColor: theme.surface, borderColor: LightTheme.accent },
          ]}
        >
          <Text style={styles.ghostTitle} numberOfLines={1}>
            {draggingActivity.titel || draggingActivity.type}
          </Text>
          {draggingActivity.km != null && (
            <Text style={styles.ghostKm}>{draggingActivity.km} km</Text>
          )}
        </View>
      )}

      <DayDetailModal
        activity={selectedActivity}
        visible={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
      <AddActivityModal
        visible={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
      <ImportModal
        visible={importOpen}
        onClose={() => setImportOpen(false)}
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
  root:            { flex: 1, backgroundColor: LightTheme.bg },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.md },
  navBtn:          { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
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
  stripDayHover:   { borderWidth: 2, borderColor: LightTheme.accent, paddingVertical: Spacing.sm - 2 },
  stripDayName:    { fontFamily: Fonts.displayMedium, fontSize: 10, color: LightTheme.muted },
  stripDayNum:     { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: LightTheme.text },
  stripTextActive: { color: '#fff' },
  stripDot:        { width: 4, height: 4, borderRadius: 2 },
  scroll:          { flex: 1 },
  scrollContent:   { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs },
  emptyState:      { paddingTop: Spacing.xxl, alignItems: 'center', gap: Spacing.md },
  emptyText:       { fontFamily: Fonts.mono, fontSize: 13, color: LightTheme.muted },
  emptyBtn:        { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: LightTheme.accent },
  emptyBtnText:    { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: '#fff' },
  ghost: {
    position: 'absolute',
    width: 160,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  ghostTitle: {
    flex: 1,
    fontFamily: Fonts.displaySemiBold,
    fontSize: 13,
    color: LightTheme.text,
  },
  ghostKm: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    color: LightTheme.text2,
  },
})
