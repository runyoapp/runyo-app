import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { DAYS_NL } from '@/utils/date'
import { dateFromOffset, toDateString, weekStart, addDays, dayOffsetFromDate } from '@/utils/date'
import { ActivityColors } from '@/constants/theme'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import type { Activity } from '@/types/activity'
import type { ActivityType } from '@/constants/activities'

type Props = {
  dayOffset: number
  activities: Activity[]
  onSelectDay: (offset: number) => void
  onPrevWeek: () => void
  onNextWeek: () => void
}

export function DayStrip({ dayOffset, activities, onSelectDay, onPrevWeek, onNextWeek }: Props) {
  const selected = dateFromOffset(dayOffset)
  const start    = weekStart(selected)

  const days = Array.from({ length: 7 }, (_, i) => {
    const date   = addDays(start, i)
    const str    = toDateString(date)
    const offset = dayOffsetFromDate(date)
    const active = offset === dayOffset
    const act    = activities.find(a => a.datum === str && a.type !== 'rest')
    const color  = act
      ? (active ? 'rgba(255,255,255,0.7)' : ActivityColors[act.type as ActivityType]?.text ?? LightTheme.accent)
      : 'transparent'

    return { date, str, offset, active, color, label: DAYS_NL[i] }
  })

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPrevWeek} style={styles.navBtn}>
        <Text style={styles.navArrow}>‹</Text>
      </TouchableOpacity>

      <View style={styles.days}>
        {days.map(d => (
          <TouchableOpacity
            key={d.str}
            style={[styles.dayBlock, d.active && styles.dayBlockActive]}
            onPress={() => onSelectDay(d.offset)}
          >
            <Text style={[styles.dayName, d.active && styles.dayNameActive]}>{d.label}</Text>
            <Text style={[styles.dayNum,  d.active && styles.dayNumActive]}>{d.date.getDate()}</Text>
            <View style={[styles.dot, { backgroundColor: d.color }]} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={onNextWeek} style={styles.navBtn}>
        <Text style={styles.navArrow}>›</Text>
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
    color: LightTheme.muted,
  },
  days: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayBlock: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    gap: 2,
  },
  dayBlockActive: {
    backgroundColor: LightTheme.accent,
  },
  dayName: {
    fontFamily: Fonts.displayMedium,
    fontSize: 10,
    color: LightTheme.muted,
  },
  dayNameActive: { color: '#fff' },
  dayNum: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 15,
    color: LightTheme.text,
  },
  dayNumActive: { color: '#fff' },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
})
