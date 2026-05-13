import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { PlanRow } from './PlanRow'
import { fromDateString } from '@/utils/date'
import type { Activity } from '@/types/activity'

type Props = {
  fase: string
  rows: Activity[]
  isOpen: boolean
  today: string
  onToggle: () => void
  onEdit: (activity: Activity) => void
}

export function PhaseBlock({ fase, rows, isOpen, today, onToggle, onEdit }: Props) {
  const sorted    = [...rows].sort((a, b) => a.datum.localeCompare(b.datum))
  const startDate = sorted[0]?.datum
  const endDate   = sorted[sorted.length - 1]?.datum
  const allPast   = !!endDate && endDate < today
  const hasFuture = !!startDate && startDate > today
  const isCurrent = !allPast && !hasFuture

  // Phase number from e.g. "Fase 1 · Opbouw" or "Fase 2"
  const numMatch  = fase.match(/\d+/)
  const num       = numMatch ? String(numMatch[0]).padStart(2, '0') : '—'
  const shortName = fase.replace(/^Fase\s*\d+\s*[·–-]\s*/i, '').trim() || fase

  // Week count
  let weeks = ''
  if (startDate && endDate) {
    const wks = Math.max(1, Math.ceil(
      (fromDateString(endDate).getTime() - fromDateString(startDate).getTime()) / 604800000 + 1
    ))
    weeks = `${wks}w`
  }

  // Group rows by date
  const byDate: { datum: string; rows: Activity[] }[] = []
  sorted.forEach(row => {
    const last = byDate[byDate.length - 1]
    if (last && last.datum === row.datum) last.rows.push(row)
    else byDate.push({ datum: row.datum, rows: [row] })
  })

  return (
    <View style={styles.block}>
      <TouchableOpacity
        style={[styles.header, isCurrent && styles.headerCurrent, allPast && styles.headerPast]}
        onPress={onToggle}
        activeOpacity={0.75}
      >
        <Text style={styles.num}>{num}</Text>
        <Text style={styles.name} numberOfLines={1}>{shortName}</Text>
        {!!weeks && <Text style={styles.weeks}>{weeks}</Text>}
        <Text style={styles.status}>
          {allPast ? '✓' : isCurrent ? '→' : ''}
        </Text>
        <Text style={[styles.chevron, isOpen && styles.chevronOpen]}>›</Text>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.rows}>
          {byDate.map(({ datum, rows: dayRows }) => (
            <PlanRow
              key={datum}
              datum={datum}
              rows={dayRows}
              isToday={datum === today}
              isPast={datum < today}
              onEdit={onEdit}
            />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  block:         { marginBottom: 4 },
  header:        { flexDirection: 'row', alignItems: 'center', backgroundColor: LightTheme.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.sm },
  headerCurrent: { borderLeftWidth: 3, borderLeftColor: LightTheme.accent },
  headerPast:    { opacity: 0.6 },
  num:           { fontFamily: Fonts.mono, fontSize: 13, color: LightTheme.faint, width: 24 },
  name:          { fontFamily: Fonts.displaySemiBold, fontSize: 15, color: LightTheme.text, flex: 1 },
  weeks:         { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted },
  status:        { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.accent, width: 16, textAlign: 'center' },
  chevron:       { fontFamily: Fonts.display, fontSize: 16, color: LightTheme.faint },
  chevronOpen:   { transform: [{ rotate: '90deg' }] },
  rows:          { paddingTop: Spacing.xs },
})
