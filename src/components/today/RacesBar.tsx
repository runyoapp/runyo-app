import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import type { Activity } from '@/types/activity'

type Props = {
  activities: Activity[]
  onRacePress: (activity: Activity) => void
}

function countdown(dateStr: string): { val: string; unit: string } {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const race  = new Date(dateStr); race.setHours(0, 0, 0, 0)
  const days  = Math.round((race.getTime() - today.getTime()) / 86400000)
  if (days < 0)   return { val: String(Math.abs(days)), unit: 'd geleden' }
  if (days === 0)  return { val: 'vandaag', unit: '🏁' }
  if (days < 7)   return { val: String(days), unit: days === 1 ? 'dag' : 'dagen' }
  const weeks = Math.round(days / 7)
  return { val: String(weeks), unit: weeks === 1 ? 'wk' : 'wk' }
}

const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

function fmtDate(dateStr: string): string {
  const [,mm, dd] = dateStr.split('-')
  return `${parseInt(dd)} ${MONTHS[parseInt(mm) - 1]}`
}

// Canonical race chip header — spec: runyo-pwa.jsx RaceHeader
// Collapsed: primary race row. Expanded: timeline of upcoming races.
export function RacesBar({ activities, onRacePress }: Props) {
  const theme  = useTheme()
  const today  = new Date().toISOString().split('T')[0]
  const [open, setOpen] = useState(false)

  const races = activities
    .filter(a => a.type === 'race' && a.datum >= today)
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .slice(0, 5)

  if (!races.length) return null

  const main = races[0]
  const cd   = countdown(main.datum)
  const rest = races.slice(1)

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Primary race row */}
      <TouchableOpacity
        style={styles.mainRow}
        onPress={() => rest.length > 0 ? setOpen(o => !o) : onRacePress(main)}
        activeOpacity={0.8}
      >
        <View style={[styles.dot, { shadowColor: '#C8336B' }]} />
        <View style={styles.body}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {main.titel || main.datum}
            {main.km != null ? ` · ${main.km} km` : ''}
          </Text>
          <Text style={[styles.meta, { color: theme.muted }]}>
            {fmtDate(main.datum)} · A-race
          </Text>
        </View>
        {/* Countdown */}
        <View style={styles.countdownBox}>
          <Text style={[styles.countdownVal, { color: '#C8336B' }]}>{cd.val}</Text>
          <Text style={[styles.countdownUnit, { color: theme.muted }]}>{cd.unit}</Text>
        </View>
        {/* Edit button on primary race */}
        <TouchableOpacity onPress={() => onRacePress(main)} style={styles.editBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.editBtnText, { color: theme.muted }]}>Bewerk</Text>
        </TouchableOpacity>
        {rest.length > 0 && (
          <Text style={[styles.chevron, { color: theme.muted, transform: [{ rotate: open ? '90deg' : '0deg' }] }]}>›</Text>
        )}
      </TouchableOpacity>

      {/* Expanded timeline */}
      {open && rest.length > 0 && (
        <View style={[styles.timeline, { borderTopColor: theme.border }]}>
          <Text style={[styles.timelineTitle, { color: theme.muted }]}>Volgende races</Text>
          <View style={styles.timelineList}>
            <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
            {rest.map((race, i) => {
              const rcd = countdown(race.datum)
              return (
                <TouchableOpacity key={race.id} style={styles.timelineRow} onPress={() => onRacePress(race)}>
                  <View style={[styles.timelineDot, { backgroundColor: theme.muted, borderColor: theme.surface }]} />
                  <View style={styles.timelineBody}>
                    <Text style={[styles.timelineRaceName, { color: theme.text2 }]} numberOfLines={1}>
                      {race.titel || race.datum}{race.km != null ? ` · ${race.km} km` : ''}
                    </Text>
                    <Text style={[styles.timelineRaceMeta, { color: theme.muted }]}>
                      {fmtDate(race.datum)} · B-race
                    </Text>
                  </View>
                  <Text style={[styles.timelineDays, { color: theme.muted }]}>{rcd.val}{rcd.unit}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { marginHorizontal: Spacing.lg, marginBottom: 2, borderRadius: Radius.md, borderWidth: 1, overflow: 'hidden' },
  mainRow:         { flexDirection: 'row', alignItems: 'center', padding: '12px 14px' as any, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  dot:             { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C8336B', flexShrink: 0, shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  body:            { flex: 1, minWidth: 0 },
  name:            { fontFamily: Fonts.displaySemiBold, fontSize: 13, letterSpacing: -0.1 },
  meta:            { fontFamily: Fonts.display, fontSize: 12, marginTop: 1 },
  countdownBox:    { alignItems: 'flex-end' },
  countdownVal:    { fontFamily: Fonts.displayBold, fontSize: 22, letterSpacing: -0.5, lineHeight: 24 },
  countdownUnit:   { fontFamily: Fonts.display, fontSize: 11, marginTop: 1 },
  editBtn:         { paddingHorizontal: 6, paddingVertical: 2 },
  editBtnText:     { fontFamily: Fonts.displayMedium, fontSize: 12 },
  chevron:         { fontFamily: Fonts.display, fontSize: 14, width: 14, textAlign: 'center' },

  // Timeline (expanded)
  timeline:        { borderTopWidth: 1, padding: 14 },
  timelineTitle:   { fontFamily: Fonts.displaySemiBold, fontSize: 12, letterSpacing: -0.1, marginBottom: 12 },
  timelineList:    { position: 'relative', paddingLeft: 14 },
  timelineLine:    { position: 'absolute', left: 3, top: 4, bottom: 4, width: 1 },
  timelineRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  timelineDot:     { position: 'absolute', left: -14, top: 10, width: 6, height: 6, borderRadius: 3, borderWidth: 2 },
  timelineBody:    { flex: 1, minWidth: 0 },
  timelineRaceName:{ fontFamily: Fonts.displayMedium, fontSize: 13, letterSpacing: -0.1 },
  timelineRaceMeta:{ fontFamily: Fonts.display, fontSize: 11, marginTop: 1 },
  timelineDays:    { fontFamily: Fonts.displaySemiBold, fontSize: 13 },
})
