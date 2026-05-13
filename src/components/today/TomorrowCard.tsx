import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { ActivityColors } from '@/constants/theme'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { TYPE_DISPLAY } from '@/constants/activities'
import { DAYS_NL, toDateString, addDays, mondayIndex } from '@/utils/date'
import type { Activity } from '@/types/activity'
import type { ActivityType } from '@/constants/activities'

type Props = {
  activity: Activity
  onPress: () => void
}

export function TomorrowCard({ activity, onPress }: Props) {
  const theme  = useTheme()
  const tmr    = addDays(new Date(), 1)
  const colors = ActivityColors[activity.type as ActivityType] ?? ActivityColors.run
  const label  = TYPE_DISPLAY[activity.type as ActivityType]?.nl ?? activity.type
  const dayStr = `${DAYS_NL[mondayIndex(tmr)]} ${tmr.getDate()}`

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: theme.surface }]} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.bar, { backgroundColor: colors.text }]} />
      <View style={styles.body}>
        <Text style={styles.label}>Morgen · {dayStr}</Text>
        <Text style={styles.title}>
          {activity.titel || label}
          {activity.km ? ` · ${activity.km} km` : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LightTheme.surface,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  bar: {
    width: 4,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    padding: Spacing.md,
    gap: 2,
  },
  label: {
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
  chevron: {
    fontFamily: Fonts.display,
    fontSize: 20,
    color: LightTheme.faint,
    paddingRight: Spacing.md,
  },
})
