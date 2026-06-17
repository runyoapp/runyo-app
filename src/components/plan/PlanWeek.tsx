import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LightTheme, Fonts, Spacing, Radius, ActivityColors } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { TYPE_DISPLAY } from '@/constants/activities'
import { DAYS_NL, fromDateString, mondayIndex } from '@/utils/date'
import type { Activity, ActivityType } from '@/types/activity'

export type PlanWeekData = {
  num: number
  range: string
  goalKm: number
  doneKm: number
  status: 'done' | 'current' | 'next'
  hasRace: boolean
  days: Activity[]   // gesorteerd op datum, zonder 'work'
}

type Props = {
  week: PlanWeekData
  maxGoalKm: number
  expanded: boolean
  onToggle: () => void
  onEditWeek: () => void   // → weekbouwer (stap 3); nu nog inert
}

// Eén dagrij in het uitgeklapte weekdetail. Rust = dunne, gedempte rij.
function DayRow({ activity }: { activity: Activity }) {
  const d       = fromDateString(activity.datum)
  const dayName = DAYS_NL[mondayIndex(d)].toLowerCase()
  const rest    = activity.type === 'rest' || (activity.km ?? 0) === 0
  const isRace  = activity.type === 'race'
  const colors  = ActivityColors[activity.type as ActivityType] ?? ActivityColors.run
  const label   = activity.titel || (TYPE_DISPLAY[activity.type as ActivityType]?.nl ?? activity.type)

  return (
    <View style={[styles.dayRow, rest && styles.dayRowRest]}>
      <View style={[styles.dayBar, { backgroundColor: rest ? LightTheme.border : colors.text }]} />
      <Text style={styles.dayDate}>{dayName} {d.getDate()}</Text>
      <Text
        style={[
          styles.dayTitle,
          rest && styles.dayTitleRest,
          isRace && { color: ActivityColors.race.text },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {!rest && activity.km != null && (
        <Text style={styles.dayKm}>{activity.km} km</Text>
      )}
    </View>
  )
}

export function PlanWeek({ week, maxGoalKm, expanded, onToggle, onEditWeek }: Props) {
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
        <Text style={[styles.weekNum, cur && { color: theme.accent }]}>Week {week.num}</Text>
        <Text style={styles.weekRange}>{week.range}</Text>
        <View style={{ flex: 1 }} />
        <Text style={[styles.weekMeta, week.hasRace && { color: ActivityColors.race.text }]}>
          {count} · {week.goalKm} km
        </Text>
        <Text style={[styles.chevron, expanded && styles.chevronOpen]}>›</Text>
      </TouchableOpacity>

      {/* Volume-balk */}
      <View style={styles.volTrack}>
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
          {week.days.map(a => <DayRow key={a.id} activity={a} />)}
          <TouchableOpacity style={styles.editLink} onPress={onEditWeek} activeOpacity={0.7}>
            <Text style={styles.editLinkText}>
              Bewerk in <Text style={styles.editLinkStrong}>weekbouwer</Text>
            </Text>
            <Text style={styles.editLinkChevron}>›</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper:        { marginBottom: Spacing.md },
  head:           { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingBottom: 6 },
  weekNum:        { fontFamily: Fonts.displayBold, fontSize: 14, color: LightTheme.text, letterSpacing: -0.3 },
  weekRange:      { fontFamily: Fonts.display, fontSize: 12, color: LightTheme.muted },
  weekMeta:       { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted },
  chevron:        { fontFamily: Fonts.display, fontSize: 16, color: LightTheme.faint, width: 14, textAlign: 'center' },
  chevronOpen:    { transform: [{ rotate: '90deg' }] },
  volTrack:       { height: 3, backgroundColor: LightTheme.border, borderRadius: 999, marginHorizontal: Spacing.sm, overflow: 'hidden' },
  volFill:        { height: '100%', borderRadius: 999 },

  detail:         { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden', marginTop: Spacing.sm },
  dayRow:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 9 },
  dayRowRest:     { paddingVertical: 7 },
  dayBar:         { width: 3, height: 22, borderRadius: 2 },
  dayDate:        { width: 44, fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted },
  dayTitle:       { flex: 1, minWidth: 0, fontFamily: Fonts.displaySemiBold, fontSize: 13, color: LightTheme.text, letterSpacing: -0.1 },
  dayTitleRest:   { fontFamily: Fonts.displayMedium, color: LightTheme.muted },
  dayKm:          { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.text2 },

  editLink:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 11, borderTopWidth: 1, borderTopColor: LightTheme.border, backgroundColor: LightTheme.surface2 },
  editLinkText:   { flex: 1, fontFamily: Fonts.display, fontSize: 13, color: LightTheme.muted },
  editLinkStrong: { fontFamily: Fonts.displaySemiBold, color: LightTheme.text },
  editLinkChevron:{ fontFamily: Fonts.display, fontSize: 16, color: LightTheme.muted },
})
