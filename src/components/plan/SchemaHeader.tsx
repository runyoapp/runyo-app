import { View, Text, StyleSheet } from 'react-native'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { fromDateString, toDateString, addDays, MONTHS_NL } from '@/utils/date'
import type { PlanWeekData } from '@/components/plan/PlanWeek'
import type { Activity } from '@/types/activity'

type Props = { weeks: PlanWeekData[]; activities: Activity[] }

function fmt(dateStr: string): string {
  const d = fromDateString(dateStr)
  return `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
}

// Week-telling, km en voortgang komen uit dezelfde week-data als de lijst eronder,
// zodat "Week X van Y" altijd klopt met het aantal week-rijen (één bron van waarheid).
export function SchemaHeader({ weeks, activities }: Props) {
  const theme      = useTheme()
  const today      = toDateString(new Date())
  const totalKm    = weeks.reduce((s, w) => s + w.goalKm, 0)
  const totalWeeks = weeks.length
  const doneCount  = weeks.filter(w => w.status === 'done').length
  const current    = weeks.find(w => w.status === 'current')
  const weekNum    = current ? current.num : Math.min(totalWeeks, doneCount + 1)
  const pct        = totalWeeks > 0 ? Math.min(100, Math.round(doneCount / totalWeeks * 100)) : 0

  const races      = activities.filter(a => a.type === 'race').sort((a, b) => a.datum.localeCompare(b.datum))
  const nextRace   = races.find(r => r.datum >= today)
  const schemaName = nextRace?.titel ?? 'Training'

  const firstWeek  = weeks[0]
  const lastWeek   = weeks[weeks.length - 1]
  // Start/eind volgen de vaste span (maandag van week 1 → zondag van de laatste week),
  // robuust ook als die weken leeg zijn. Een aankomende race overschrijft het eind-label.
  const startDate  = firstWeek?.monday
  const endDate    = nextRace?.datum ??
    (lastWeek ? toDateString(addDays(fromDateString(lastWeek.monday), 6)) : undefined)
  const endLabel   = nextRace ? 'Race' : 'Eind'

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* "Schema · X km" — spec: runyo-pwa.jsx ScreenTraining */}
      <Text style={[styles.kicker, { color: theme.muted }]}>
        Schema{totalKm > 0 ? ` · ${Math.round(totalKm)} km` : ''}
      </Text>
      <Text style={[styles.title, { color: theme.text }]}>{schemaName}</Text>
      {totalWeeks > 1 && (
        <Text style={[styles.sub, { color: theme.muted }]}>Week {weekNum} van {totalWeeks}</Text>
      )}
      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
      </View>
      {startDate && endDate && (
        <View style={styles.dates}>
          <Text style={[styles.dateLabel, { color: theme.faint }]}>Start · {fmt(startDate)}</Text>
          <Text style={[styles.dateLabel, { color: theme.faint }]}>{endLabel} · {fmt(endDate)}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:     { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  kicker:        { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  title:         { fontFamily: Fonts.displayBold, fontSize: 26, color: LightTheme.text, letterSpacing: -0.5, marginBottom: 2 },
  sub:           { fontFamily: Fonts.display, fontSize: 13, color: LightTheme.muted, marginBottom: Spacing.sm },
  progressTrack: { height: 4, backgroundColor: LightTheme.border, borderRadius: 2, marginBottom: Spacing.sm },
  progressFill:  { height: 4, backgroundColor: LightTheme.accent, borderRadius: 2 },
  dates:         { flexDirection: 'row', justifyContent: 'space-between' },
  dateLabel:     { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.faint },
})
