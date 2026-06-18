import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Fonts, Radius, type Theme } from '@/constants/theme'
import { fromDateString, MONTHS_NL } from '@/utils/date'
import { parseFeedback } from '@/components/today/FeedbackSection'
import type { Activity } from '@/types/activity'

type Props = {
  races: Activity[]            // gelopen races, in elke volgorde (wordt hier gesorteerd)
  onPress: (race: Activity) => void
}

function fmtKm(km: number): string {
  return km % 1 === 0 ? String(km) : km.toFixed(1).replace('.', ',')
}

function fmtDate(datum: string): string {
  const d = fromDateString(datum)
  return `${d.getDate()} ${MONTHS_NL[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`
}

export function RacePastList({ races, onPress }: Props) {
  const theme  = useTheme()
  // Meest recente gelopen race bovenaan.
  const sorted = [...races].sort((a, b) => b.datum.localeCompare(a.datum))
  return (
    <View>
      <Text style={[styles.heading, { color: theme.muted }]}>gelopen</Text>
      <View style={styles.list}>
        {sorted.map(r => {
          const { rating } = parseFeedback(r.feedback)
          return (
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
                  {fmtDate(r.datum)}{r.km != null ? ` · ${fmtKm(r.km)} km` : ''}
                </Text>
              </View>
              {rating > 0 ? (
                <Text style={[styles.rating, { color: theme.text2 }]}>{rating}/5</Text>
              ) : (
                <Text style={[styles.rate, { color: theme.accent }]}>beoordeel</Text>
              )}
            </Pressable>
          )
        })}
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
          // Gelopen races gedempt: ook de A-races niet meer vol accent.
          backgroundColor: theme.surface2,
          borderWidth: 1,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.tierText, { color: isA ? theme.accent : theme.text2 }]}>{tier}</Text>
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
  rating:   { fontFamily: Fonts.mono, fontSize: 11 },
  rate:     { fontFamily: Fonts.displayMedium, fontSize: 11.5 },
})
