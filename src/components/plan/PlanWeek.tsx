import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Fonts, Spacing, Radius, ActivityColors } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { TYPE_DISPLAY } from '@/constants/activities'
import { DAYS_NL, fromDateString, mondayIndex } from '@/utils/date'
import type { Activity, ActivityType } from '@/types/activity'

export type PlanWeekData = {
  num: number
  monday: string     // maandag-ISO van deze week (identificeert de week in de weekbouwer)
  range: string
  goalKm: number
  doneKm: number
  status: 'done' | 'current' | 'next'
  hasRace: boolean
  days: Activity[]   // gesorteerd op datum, zonder 'work'
}

type Props = {
  week: PlanWeekData
  today: string
  maxGoalKm: number
  expanded: boolean
  onToggle: () => void
  onActivityPress: (a: Activity) => void
  onEditWeek: () => void   // → weekbouwer (stap 3); nu nog inert
}

// Eén dagrij in het uitgeklapte weekdetail. Tikbaar → opent de activiteit-details.
// Dagen in het verleden worden gedempt getoond.
function DayRow({ activity, today, onPress }: { activity: Activity; today: string; onPress: () => void }) {
  const theme   = useTheme()
  const d       = fromDateString(activity.datum)
  const dayName = DAYS_NL[mondayIndex(d)].toLowerCase()
  const isRace  = activity.type === 'race'
  const past    = activity.datum < today
  const colors  = ActivityColors[activity.type as ActivityType] ?? ActivityColors.run
  const label   = activity.titel || (TYPE_DISPLAY[activity.type as ActivityType]?.nl ?? activity.type)

  return (
    <TouchableOpacity
      style={[styles.dayRow, past && styles.dayRowPast]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={[styles.dayBar, { backgroundColor: colors.text }]} />
      <Text style={[styles.dayDate, { color: theme.muted }]}>{dayName} {d.getDate()}</Text>
      <Text
        style={[styles.dayTitle, { color: theme.text }, isRace && { color: ActivityColors.race.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {activity.km != null && (
        <Text style={[styles.dayKm, { color: theme.text2 }]}>{activity.km} km</Text>
      )}
    </TouchableOpacity>
  )
}

export function PlanWeek({ week, today, maxGoalKm, expanded, onToggle, onActivityPress, onEditWeek }: Props) {
  const theme   = useTheme()
  const cur     = week.status === 'current'
  const done    = week.status === 'done'
  const vol     = maxGoalKm > 0 ? Math.min(1, week.goalKm / maxGoalKm) : 0
  const count   = week.days.filter(d => d.type !== 'rest' && (d.km ?? 0) > 0).length
  const barColor = week.hasRace ? ActivityColors.race.text : theme.accent

  return (
    <View style={styles.wrapper}>
      {/* Weekkop — tikbaar */}
      <TouchableOpacity
        style={styles.head}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.weekNum, { color: theme.text }, cur && { color: theme.accent }]}>Week {week.num}</Text>
        <Text style={[styles.weekRange, { color: theme.muted }]}>{week.range}</Text>
        <View style={{ flex: 1 }} />
        <Text style={[styles.weekMeta, { color: theme.muted }, week.hasRace && { color: ActivityColors.race.text }]}>
          {count} · {week.goalKm} km
        </Text>
        <Text style={[styles.chevron, { color: theme.faint }, expanded && styles.chevronOpen]}>›</Text>
      </TouchableOpacity>

      {/* Volume-balk */}
      <View style={[styles.volTrack, { backgroundColor: theme.border }]}>
        <View style={[
          styles.volFill,
          { width: `${vol * 100}%`, backgroundColor: barColor, opacity: cur ? 1 : 0.55 },
        ]} />
      </View>

      {/* Uitgeklapt detail — dagrijen + weekbouwer-link */}
      {expanded && (
        <View style={[
          styles.detail,
          { backgroundColor: theme.surface, borderColor: cur ? theme.accent : theme.border },
        ]}>
          {week.days.map(a => (
            <DayRow key={a.id} activity={a} today={today} onPress={() => onActivityPress(a)} />
          ))}
          <TouchableOpacity
            style={[styles.editLink, { borderTopColor: theme.border, backgroundColor: theme.surface2 }]}
            onPress={onEditWeek}
            activeOpacity={0.7}
          >
            <Text style={[styles.editLinkText, { color: theme.muted }]}>
              Bewerk in <Text style={[styles.editLinkStrong, { color: theme.text }]}>weekbouwer</Text>
            </Text>
            <Text style={[styles.editLinkChevron, { color: theme.muted }]}>›</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper:        { marginBottom: Spacing.md },
  head:           { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingBottom: 6 },
  weekNum:        { fontFamily: Fonts.displayBold, fontSize: 14, letterSpacing: -0.3 },
  weekRange:      { fontFamily: Fonts.display, fontSize: 12 },
  weekMeta:       { fontFamily: Fonts.mono, fontSize: 11 },
  chevron:        { fontFamily: Fonts.display, fontSize: 16, width: 14, textAlign: 'center' },
  chevronOpen:    { transform: [{ rotate: '90deg' }] },
  volTrack:       { height: 3, borderRadius: 999, marginHorizontal: Spacing.sm, overflow: 'hidden' },
  volFill:        { height: '100%', borderRadius: 999 },

  detail:         { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden', marginTop: Spacing.sm },
  dayRow:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 9 },
  dayRowPast:     { opacity: 0.5 },
  dayBar:         { width: 3, height: 22, borderRadius: 2 },
  dayDate:        { width: 44, fontFamily: Fonts.mono, fontSize: 11 },
  dayTitle:       { flex: 1, minWidth: 0, fontFamily: Fonts.displaySemiBold, fontSize: 13, letterSpacing: -0.1 },
  dayKm:          { fontFamily: Fonts.mono, fontSize: 11 },

  editLink:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 11, borderTopWidth: 1 },
  editLinkText:   { flex: 1, fontFamily: Fonts.display, fontSize: 13 },
  editLinkStrong: { fontFamily: Fonts.displaySemiBold },
  editLinkChevron:{ fontFamily: Fonts.display, fontSize: 16 },
})
