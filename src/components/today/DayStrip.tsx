import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { DAYS_NL } from '@/utils/date'
import { dateFromOffset, toDateString, weekStart, addDays, dayOffsetFromDate } from '@/utils/date'
import { ActivityColors } from '@/constants/theme'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import type { Activity } from '@/types/activity'
import type { ActivityType } from '@/constants/activities'

type Props = {
  dayOffset: number
  activities: Activity[]
  onSelectDay: (offset: number) => void
  onPrevWeek: () => void
  onNextWeek: () => void
}

// Active day = ink bg, paper text — spec: brand.md §7, runyo-pwa.jsx DayStrip
export function DayStrip({ dayOffset, activities, onSelectDay, onPrevWeek, onNextWeek }: Props) {
  const theme    = useTheme()
  const selected = dateFromOffset(dayOffset)
  const start    = weekStart(selected)

  const days = Array.from({ length: 7 }, (_, i) => {
    const date   = addDays(start, i)
    const str    = toDateString(date)
    const offset = dayOffsetFromDate(date)
    const active = offset === dayOffset
    const act    = activities.find(a => a.datum === str && a.type !== 'rest')
    // Dot: on active day use paper/accent tint, otherwise activity color
    const color  = act
      ? (active ? `${theme.bg}99` : ActivityColors[act.type as ActivityType]?.text ?? theme.accent)
      : 'transparent'

    return { date, str, offset, active, color, label: DAYS_NL[i] }
  })

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPrevWeek} style={styles.navBtn}>
        <Text style={[styles.navArrow, { color: theme.muted }]}>‹</Text>
      </TouchableOpacity>

      <View style={styles.days}>
        {days.map(d => (
          <TouchableOpacity
            key={d.str}
            style={[
              styles.dayBlock,
              { borderColor: d.active ? theme.text : theme.border },
              d.active
                ? { backgroundColor: theme.text }    // ink bg when active
                : { backgroundColor: theme.surface }, // surface when inactive
            ]}
            onPress={() => onSelectDay(d.offset)}
          >
            <Text style={[styles.dayName, { color: d.active ? theme.bg : theme.muted }]}>
              {d.label}
            </Text>
            <Text style={[styles.dayNum, { color: d.active ? theme.bg : theme.text }]}>
              {d.date.getDate()}
            </Text>
            <View style={[styles.dot, { backgroundColor: d.color }]} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={onNextWeek} style={styles.navBtn}>
        <Text style={[styles.navArrow, { color: theme.muted }]}>›</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  navBtn: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    fontFamily: Fonts.display,
    fontSize: 22,
  },
  days: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  dayBlock: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    gap: 2,
  },
  dayName: {
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  dayNum: {
    fontFamily: Fonts.displayBold,
    fontSize: 16,
    letterSpacing: -0.3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
})
