import { View, Text, StyleSheet } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
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
  isDragging: boolean
  onPress: () => void
  onDragStart: (activity: Activity, pageX: number, pageY: number) => void
  onDragMove: (pageX: number, pageY: number) => void
  onDragEnd: (pageX: number, pageY: number, cancelled: boolean) => void
}

const LONG_PRESS_MS = 350

export function WeekDayRow({
  activity, isToday, isPast, isDragging,
  onPress, onDragStart, onDragMove, onDragEnd,
}: Props) {
  const theme   = useTheme()
  const colors  = ActivityColors[activity.type as ActivityType] ?? ActivityColors.run
  const label   = TYPE_DISPLAY[activity.type as ActivityType]?.nl ?? activity.type
  const date    = fromDateString(activity.datum)
  const dayName = DAYS_NL[mondayIndex(date)]

  const isRace = activity.type === 'race'

  // runOnJS(true) keeps callbacks on JS thread → no Reanimated worklet runtime
  // needed (Reanimated 4 + Expo Go has flaky NativeWorklets HostFunction init).
  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .runOnJS(true)
    .onStart((e) => onDragStart(activity, e.absoluteX, e.absoluteY))
    .onUpdate((e) => onDragMove(e.absoluteX, e.absoluteY))
    .onEnd((e) => onDragEnd(e.absoluteX, e.absoluteY, false))
    .onFinalize((e, success) => {
      if (!success) onDragEnd(e.absoluteX, e.absoluteY, true)
    })

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((_, success) => {
      if (success) onPress()
    })

  // Pan wins over tap once long-press fires; otherwise tap fires on quick release.
  const composed = Gesture.Exclusive(pan, tap)

  return (
    <GestureDetector gesture={composed}>
      <View
        style={[
          styles.row,
          { backgroundColor: isRace ? 'rgba(200,51,107,0.06)' : theme.surface },
          isToday && !isRace && styles.rowToday,
          isRace && styles.rowRace,
          isPast && styles.rowPast,
          isDragging && styles.rowGhost,
        ]}
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
      </View>
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
  rowGhost: {
    opacity: 0.3,
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
