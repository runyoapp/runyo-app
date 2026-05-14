import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { ActivityColors } from '@/constants/theme'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { TYPE_DISPLAY } from '@/constants/activities'
import { DAYS_NL, fromDateString, mondayIndex } from '@/utils/date'
import type { Activity } from '@/types/activity'
import type { ActivityType } from '@/constants/activities'

type Props = {
  activity: Activity
  isToday: boolean
  isPast: boolean
  onPress: () => void
  onLongPress: (activity: Activity) => void
}

export function WeekDayRow({ activity, isToday, isPast, onPress, onLongPress }: Props) {
  const theme   = useTheme()
  const colors  = ActivityColors[activity.type as ActivityType] ?? ActivityColors.run
  const label   = TYPE_DISPLAY[activity.type as ActivityType]?.nl ?? activity.type
  const date    = fromDateString(activity.datum)
  const dayName = DAYS_NL[mondayIndex(date)]

  const isRace = activity.type === 'race'

  return (
    <TouchableOpacity
      style={[
        styles.row,
        { backgroundColor: isRace ? 'rgba(200,51,107,0.06)' : theme.surface },
        isToday && !isRace && styles.rowToday,
        isRace && styles.rowRace,
        isPast && styles.rowPast,
      ]}
      onPress={onPress}
      onLongPress={() => onLongPress(activity)}
      delayLongPress={400}
      activeOpacity={0.75}
    >
      <View style={[styles.bar, { backgroundColor: colors.text }]} />
      <View style={styles.body}>
        <Text style={[styles.dayLabel, isRace && { color: '#C8336B' }]}>
          {dayName.toLowerCase()} · {label.toLowerCase()}
        </Text>
        {!!activity.titel && (
          <Text style={styles.title} numberOfLines={1}>{activity.titel}</Text>
        )}
      </View>
      {activity.km != null && (
        <Text style={[styles.km, isRace && { color: '#C8336B' }]}>{activity.km} km</Text>
      )}
      <Text style={styles.handle}>⠿</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LightTheme.surface,
    borderRadius: Radius.md,
    marginBottom: 4,
    overflow: 'hidden',
  },
  rowRace: {
    borderWidth: 1,
    borderColor: 'rgba(200,51,107,0.3)',
  },
  rowToday: {
    borderWidth: 1,
    borderColor: LightTheme.accent,
  },
  rowPast: {
    opacity: 0.45,
  },
  bar: {
    width: 4,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: 2,
  },
  dayLabel: {
    fontFamily: Fonts.displayMedium,
    fontSize: 12,
    color: LightTheme.muted,
    letterSpacing: -0.1,   // mixed case per brand.md §4
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 15,
    color: LightTheme.text,
  },
  km: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    color: LightTheme.text2,
    paddingRight: Spacing.sm,
  },
  handle: {
    fontSize: 18,
    color: LightTheme.faint,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
  },
})
