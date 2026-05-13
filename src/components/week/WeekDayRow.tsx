import { useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { ActivityColors } from '@/constants/theme'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { TYPE_DISPLAY } from '@/constants/activities'
import { DAYS_NL, fromDateString, mondayIndex } from '@/utils/date'
import type { Activity } from '@/types/activity'
import type { ActivityType } from '@/constants/activities'

type Props = {
  activity: Activity
  isToday: boolean
  isPast: boolean
  onPress: () => void
  onDragStart: (activity: Activity, pageY: number) => void
  onDragMove: (pageX: number, pageY: number) => void
  onDragEnd: (pageX: number, pageY: number) => void
}

export function WeekDayRow({ activity, isToday, isPast, onPress, onDragStart, onDragMove, onDragEnd }: Props) {
  const colors  = ActivityColors[activity.type as ActivityType] ?? ActivityColors.run
  const label   = TYPE_DISPLAY[activity.type as ActivityType]?.nl ?? activity.type
  const date    = fromDateString(activity.datum)
  const dayName = DAYS_NL[mondayIndex(date)]

  const dragGesture = Gesture.Pan()
    .activateAfterLongPress(350)
    .onStart((e) => {
      runOnJS(onDragStart)(activity, e.absoluteY)
    })
    .onUpdate((e) => {
      runOnJS(onDragMove)(e.absoluteX, e.absoluteY)
    })
    .onEnd((e) => {
      runOnJS(onDragEnd)(e.absoluteX, e.absoluteY)
    })
    .onFinalize((e) => {
      runOnJS(onDragEnd)(e.absoluteX, e.absoluteY)
    })

  return (
    <GestureDetector gesture={dragGesture}>
      <TouchableOpacity
        style={[
          styles.row,
          isToday && styles.rowToday,
          isPast  && styles.rowPast,
        ]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <View style={[styles.bar, { backgroundColor: colors.text }]} />
        <View style={styles.body}>
          <Text style={styles.dayLabel}>{dayName} · {label}</Text>
          {!!activity.titel && <Text style={styles.title} numberOfLines={1}>{activity.titel}</Text>}
        </View>
        {activity.km != null && (
          <Text style={styles.km}>{activity.km} km</Text>
        )}
        <Text style={styles.handle}>⠿</Text>
      </TouchableOpacity>
    </GestureDetector>
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
  rowToday: {
    borderWidth: 1,
    borderColor: LightTheme.accent,
  },
  rowPast: {
    opacity: 0.6,
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
    fontSize: 11,
    color: LightTheme.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
