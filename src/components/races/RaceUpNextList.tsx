import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Fonts, Radius, type Theme } from '@/constants/theme'
import { fromDateString, MONTHS_NL } from '@/utils/date'
import type { Activity } from '@/types/activity'

type Props = {
  races: Activity[]            // races NA de eerstvolgende
  onPress: (race: Activity) => void
}

function fmtKm(km: number): string {
  return km % 1 === 0 ? String(km) : km.toFixed(1).replace('.', ',')
}

function fmtDate(datum: string): string {
  const d = fromDateString(datum)
  return `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
}

function weeksUntil(datum: string): number {
  const days = Math.round((fromDateString(datum).getTime() - Date.now()) / 86400000)
  return Math.max(0, Math.round(days / 7))
}

export function RaceUpNextList({ races, onPress }: Props) {
  const theme = useTheme()
  return (
    <View>
      <Text style={[styles.heading, { color: theme.muted }]}>daarna</Text>
      <View style={styles.list}>
        {races.map(r => (
          <Pressable
            key={r.id}
            onPress={() => onPress(r)}
            style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Tier tier={r.isMainGoal ? 'A' : 'B'} theme={theme} />
            <View style={styles.body}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {r.titel || fmtDate(r.datum)}
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>
                {fmtDate(r.datum)}{r.km != null ? ` · ${fmtKm(r.km)} km` : ''}{r.goalTime ? ` · doel ${r.goalTime}` : ''}
              </Text>
            </View>
            <Text style={[styles.weeks, { color: theme.text2 }]}>{weeksUntil(r.datum)}w</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function Tier({ tier, theme }: { tier: 'A' | 'B'; theme: Theme }) {
  const isA = tier === 'A'
  return (
    <View
      style={[
        styles.tier,
        {
          backgroundColor: isA ? theme.accent : theme.surface2,
          borderWidth: isA ? 0 : 1,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.tierText, { color: isA ? '#fff' : theme.accent }]}>{tier}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  heading:  { fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  list:     { gap: 8 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: Radius.lg - 1, paddingHorizontal: 13, paddingVertical: 11 },
  tier:     { width: 17, height: 17, borderRadius: 8.5, alignItems: 'center', justifyContent: 'center' },
  tierText: { fontFamily: Fonts.displayBold, fontSize: 9.5 },
  body:     { flex: 1, minWidth: 0 },
  name:     { fontFamily: Fonts.displayMedium, fontSize: 14, letterSpacing: -0.15 },
  meta:     { fontFamily: Fonts.display, fontSize: 11.5, marginTop: 1 },
  weeks:    { fontFamily: Fonts.mono, fontSize: 11 },
})
