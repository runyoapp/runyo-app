import { View, Text, StyleSheet } from 'react-native'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { fromDateString, MONTHS_NL } from '@/utils/date'
import type { Activity } from '@/types/activity'

type Props = { activities: Activity[] }

function fmt(dateStr: string): string {
  const d = fromDateString(dateStr)
  return `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
}

export function SchemaHeader({ activities }: Props) {
  const theme     = useTheme()
  const today     = new Date().toISOString().split('T')[0]
  const allRows   = activities.filter(a => a.datum)
  const totalKm   = allRows.reduce((s, a) => s + (a.km ?? 0), 0)
  const races     = allRows.filter(a => a.type === 'race').sort((a, b) => a.datum.localeCompare(b.datum))
  const nextRace  = races.find(r => r.datum >= today)
  const schemaName = nextRace?.titel ?? 'Training'
  const startDate  = allRows[0]?.datum
  const endDate    = nextRace?.datum ?? allRows[allRows.length - 1]?.datum

  let weekNum = 1, totalWeeks = 1, pct = 0
  if (startDate && endDate) {
    const s = fromDateString(startDate).getTime()
    const e = fromDateString(endDate).getTime()
    const n = new Date().setHours(12, 0, 0, 0)
    totalWeeks = Math.max(1, Math.ceil((e - s) / 604800000))
    weekNum    = Math.min(totalWeeks, Math.max(1, Math.ceil((n - s) / 604800000) + 1))
    pct        = Math.min(100, Math.round((weekNum - 1) / totalWeeks * 100))
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={styles.kicker}>
        training{totalKm > 0 ? ` · ${Math.round(totalKm)} km` : ''}
      </Text>
      <Text style={styles.title}>{schemaName}</Text>
      <Text style={styles.sub}>Week {weekNum} van {totalWeeks}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      {startDate && endDate && (
        <View style={styles.dates}>
          <Text style={styles.dateLabel}>Start · {fmt(startDate)}</Text>
          <Text style={styles.dateLabel}>Race · {fmt(endDate)}</Text>
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
