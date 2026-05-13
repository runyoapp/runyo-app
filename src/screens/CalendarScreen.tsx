import { useState, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, PanResponder } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDataStore } from '@/stores/dataStore'
import { useActivities } from '@/hooks/useActivities'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { RaceCard } from '@/components/calendar/RaceCard'
import { ActivityColors } from '@/constants/theme'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { TYPE_DISPLAY } from '@/constants/activities'
import { MONTHS_FULL_NL } from '@/utils/date'
import type { Activity } from '@/types/activity'
import type { ActivityType } from '@/constants/activities'

export function CalendarScreen() {
  const insets     = useSafeAreaInsets()
  const activities = useDataStore(s => s.activities)
  const calYear    = useDataStore(s => s.calYear)
  const calMonth   = useDataStore(s => s.calMonth)
  const setCalDate = useDataStore(s => s.setCalDate)
  useActivities()

  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  function prevMonth() {
    if (calMonth === 0) setCalDate(calYear - 1, 11)
    else setCalDate(calYear, calMonth - 1)
    setSelectedDate(null)
  }

  function nextMonth() {
    if (calMonth === 11) setCalDate(calYear + 1, 0)
    else setCalDate(calYear, calMonth + 1)
    setSelectedDate(null)
  }

  // Swipe left/right to change month
  const swipeRef = useRef({ startX: 0 })
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 10,
    onPanResponderGrant: (e) => { swipeRef.current.startX = e.nativeEvent.pageX },
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 50) g.dx < 0 ? nextMonth() : prevMonth()
    },
  })

  // Activities for selected date
  const selectedRows = selectedDate
    ? activities.filter(a => a.datum === selectedDate)
    : []

  // Races this month
  const monthRaces = activities
    .filter(a => {
      if (a.type !== 'race' || !a.datum) return false
      const d = new Date(a.datum)
      return d.getFullYear() === calYear && d.getMonth() === calMonth
    })
    .sort((a, b) => a.datum.localeCompare(b.datum))

  // Activity type legend for this month
  const monthTypes = [...new Set(
    activities
      .filter(a => {
        if (!a.datum || a.type === 'rest' || a.type === 'work') return false
        const d = new Date(a.datum)
        return d.getFullYear() === calYear && d.getMonth() === calMonth
      })
      .map(a => a.type as ActivityType)
  )]

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Month header */}
      <View style={styles.header}>
        <Text style={styles.monthTitle}>
          {MONTHS_FULL_NL[calMonth]} {calYear}
        </Text>
        <View style={styles.navRow}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        {...panResponder.panHandlers}
      >
        {/* Calendar grid */}
        <View style={styles.gridContainer}>
          <CalendarGrid
            year={calYear}
            month={calMonth}
            activities={activities}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </View>

        {/* Legend */}
        {monthTypes.length > 0 && (
          <View style={styles.legend}>
            {monthTypes.map(type => {
              const color = ActivityColors[type]?.text ?? LightTheme.accent
              const label = TYPE_DISPLAY[type]?.nl ?? type
              return (
                <View key={type} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={styles.legendLabel}>{label}</Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Selected date detail */}
        {selectedDate && selectedRows.length > 0 && (
          <View style={styles.section}>
            {selectedRows.map(row => {
              const colors = ActivityColors[row.type as ActivityType] ?? ActivityColors.run
              const label  = TYPE_DISPLAY[row.type as ActivityType]?.nl ?? row.type
              return (
                <TouchableOpacity key={row.id} style={styles.dayCard} activeOpacity={0.8}>
                  <View style={[styles.dayCardBar, { backgroundColor: colors.text }]} />
                  <View style={styles.dayCardBody}>
                    <Text style={styles.dayCardLabel}>{label}</Text>
                    <Text style={styles.dayCardTitle}>
                      {row.titel || label}{row.km != null ? ` · ${row.km} km` : ''}
                    </Text>
                  </View>
                  <Text style={styles.dayCardChevron}>›</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {/* Races this month */}
        {monthRaces.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Races deze maand</Text>
            {monthRaces.map(race => (
              <RaceCard key={race.id} race={race} onPress={() => setSelectedDate(race.datum)} />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: LightTheme.bg },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  monthTitle:    { fontFamily: Fonts.displayBold, fontSize: 20, color: LightTheme.text, textTransform: 'capitalize' },
  navRow:        { flexDirection: 'row', gap: Spacing.sm },
  navBtn:        { padding: Spacing.sm },
  navArrow:      { fontFamily: Fonts.display, fontSize: 22, color: LightTheme.muted },
  gridContainer: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  legend:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:     { width: 6, height: 6, borderRadius: 3 },
  legendLabel:   { fontFamily: Fonts.displayMedium, fontSize: 11, color: LightTheme.muted },
  section:       { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle:  { fontFamily: Fonts.displaySemiBold, fontSize: 13, color: LightTheme.muted, marginBottom: Spacing.sm },
  dayCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: LightTheme.surface, borderRadius: Radius.md, marginBottom: 4, overflow: 'hidden' },
  dayCardBar:    { width: 4, alignSelf: 'stretch' },
  dayCardBody:   { flex: 1, padding: Spacing.md, gap: 2 },
  dayCardLabel:  { fontFamily: Fonts.displayMedium, fontSize: 11, color: LightTheme.muted, textTransform: 'uppercase' },
  dayCardTitle:  { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: LightTheme.text },
  dayCardChevron:{ fontFamily: Fonts.display, fontSize: 18, color: LightTheme.faint, paddingRight: Spacing.md },
})
