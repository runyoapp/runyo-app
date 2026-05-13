import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LightTheme, Fonts, Spacing, Radius, ActivityColors } from '@/constants/theme'
import { TYPE_DISPLAY } from '@/constants/activities'
import { DAYS_NL, MONTHS_NL, fromDateString, mondayIndex } from '@/utils/date'
import type { Activity, ActivityType } from '@/types/activity'

type Props = {
  datum: string
  rows: Activity[]
  isToday: boolean
  isPast: boolean
  onEdit: (activity: Activity) => void
}

export function PlanRow({ datum, rows, isToday, isPast, onEdit }: Props) {
  const [expanded, setExpanded] = useState(isToday)
  const d        = fromDateString(datum)
  const dayName  = DAYS_NL[mondayIndex(d)]
  const dateStr  = `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
  const mainRow  = rows[0]
  const colors   = ActivityColors[mainRow?.type as ActivityType] ?? ActivityColors.run
  const hasKm    = rows.some(r => r.km != null)
  const hasFb    = rows.some(r => r.feedback)
  const allWork  = rows.every(r => r.type === 'work')

  if (allWork) return null

  return (
    <TouchableOpacity
      style={[styles.row, isToday && styles.rowToday, isPast && styles.rowPast]}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.8}
    >
      {/* Collapsed header */}
      <View style={styles.header}>
        <View style={styles.dateBlock}>
          <Text style={styles.dayName}>{dayName}</Text>
          <Text style={styles.dateNum}>{dateStr}</Text>
        </View>
        <View style={[styles.typeDot, { backgroundColor: colors.text }]} />
        <View style={styles.bodyBlock}>
          <Text style={styles.titleText} numberOfLines={1}>
            {rows.map(r => r.titel || (TYPE_DISPLAY[r.type as ActivityType]?.nl ?? r.type)).join(' · ')}
          </Text>
        </View>
        {hasKm && (
          <Text style={styles.km}>
            {rows.filter(r => r.km != null).map(r => `${r.km}`).join('+')} km
          </Text>
        )}
        {hasFb && <View style={styles.fbDot} />}
        <Text style={styles.chevron}>{expanded ? '∨' : '›'}</Text>
      </View>

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.detail}>
          {rows.filter(r => r.type !== 'work').map(r => {
            const rc = ActivityColors[r.type as ActivityType] ?? ActivityColors.run
            const rl = TYPE_DISPLAY[r.type as ActivityType]?.nl ?? r.type
            return (
              <View key={r.id} style={styles.detailRow}>
                <View style={styles.detailBadgeRow}>
                  <View style={[styles.badge, { backgroundColor: rc.bg }]}>
                    <Text style={[styles.badgeText, { color: rc.text }]}>{rl}</Text>
                  </View>
                  {r.km != null && (
                    <Text style={styles.detailKm}>{r.km} km</Text>
                  )}
                </View>
                {!!r.titel && <Text style={styles.detailTitle}>{r.titel}</Text>}
                {!!r.detail && <Text style={styles.detailDesc}>{r.detail}</Text>}
                {!!r.feedback && (
                  <Text style={styles.detailFeedback}>✓ {r.feedback}</Text>
                )}
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => onEdit(r)}
                >
                  <Text style={styles.editBtnText}>Bewerken</Text>
                </TouchableOpacity>
              </View>
            )
          })}
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row:          { backgroundColor: LightTheme.surface, borderRadius: Radius.md, marginBottom: 4, overflow: 'hidden' },
  rowToday:     { borderWidth: 1.5, borderColor: LightTheme.accent },
  rowPast:      { opacity: 0.55 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  dateBlock:    { width: 52 },
  dayName:      { fontFamily: Fonts.displayMedium, fontSize: 10, color: LightTheme.muted, textTransform: 'uppercase' },
  dateNum:      { fontFamily: Fonts.displaySemiBold, fontSize: 13, color: LightTheme.text },
  typeDot:      { width: 8, height: 8, borderRadius: 4 },
  bodyBlock:    { flex: 1, minWidth: 0 },
  titleText:    { fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text },
  km:           { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted },
  fbDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: LightTheme.accent },
  chevron:      { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.faint, width: 16, textAlign: 'center' },
  detail:       { borderTopWidth: 1, borderTopColor: LightTheme.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  detailRow:    { paddingVertical: Spacing.sm },
  detailBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  badge:        { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  badgeText:    { fontFamily: Fonts.displayMedium, fontSize: 11 },
  detailKm:     { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.accent },
  detailTitle:  { fontFamily: Fonts.displayBold, fontSize: 14, color: LightTheme.text, marginBottom: 2 },
  detailDesc:   { fontFamily: Fonts.mono, fontSize: 12, color: LightTheme.muted, lineHeight: 18, marginBottom: 4 },
  detailFeedback: { fontFamily: Fonts.display, fontSize: 13, color: LightTheme.accent, marginBottom: 4 },
  editBtn:      { alignSelf: 'flex-start', borderWidth: 1, borderColor: LightTheme.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 4, marginTop: 4 },
  editBtnText:  { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.muted },
})
