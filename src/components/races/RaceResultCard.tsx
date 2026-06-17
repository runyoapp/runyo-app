import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Fonts, Radius } from '@/constants/theme'
import { MONTHS_NL, fromDateString, raceCountdown } from '@/utils/date'
import { derivePace } from '@/utils/raceProgress'
import { FeedbackBadge } from '@/components/today/FeedbackSection'
import type { Activity } from '@/types/activity'

type Props = {
  race: Activity
  onPress: () => void     // open detail
  onRate: () => void      // open detail in beoordeel-modus
}

function fmtKm(km: number): string {
  return km % 1 === 0 ? String(km) : km.toFixed(1).replace('.', ',')
}

function fmtDate(datum: string): string {
  const d = fromDateString(datum)
  return `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
}

// Kaart voor de meest recente gelopen race wanneer er geen toekomstige race is.
// Toont datum/afstand/doel + de beoordeling (of een knop om die in te vullen).
export function RaceResultCard({ race, onPress, onRate }: Props) {
  const theme  = useTheme()
  const pace   = derivePace(race.goalTime, race.km)
  const cd     = raceCountdown(race.datum)
  const isMain = !!race.isMainGoal

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        <View style={styles.tierRow}>
          <View style={[styles.tierBadge, {
            backgroundColor: isMain ? theme.accent : theme.surface2,
            borderWidth: isMain ? 0 : 1, borderColor: theme.border,
          }]}>
            <Text style={[styles.tierBadgeText, { color: isMain ? '#fff' : theme.text2 }]}>{isMain ? 'A' : 'B'}</Text>
          </View>
          <Text style={[styles.kicker, { color: theme.muted }]}>laatste race</Text>
        </View>

        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {race.titel || fmtDate(race.datum)}
        </Text>
        <Text style={[styles.meta, { color: theme.muted }]}>
          {fmtDate(race.datum)}{race.km != null ? ` · ${fmtKm(race.km)} km` : ''} · {cd.val} {cd.unit}
        </Text>

        {race.goalTime && (
          <View style={[styles.goalPill, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
            <View style={[styles.goalDot, { backgroundColor: theme.accent }]} />
            <Text style={[styles.goalText, { color: theme.text2 }]} numberOfLines={1}>
              doel {race.goalTime}{pace ? ` · ${pace}/km` : ''}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Beoordeling: badge als ingevuld, anders een knop om in te vullen */}
      {race.feedback ? (
        <View style={{ marginTop: 14 }}>
          <FeedbackBadge feedback={race.feedback} onPress={onRate} />
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.rateBtn, { borderColor: theme.accent }]}
          onPress={onRate}
          activeOpacity={0.8}
        >
          <Text style={[styles.rateText, { color: theme.accent }]}>Beoordeel race</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card:         { padding: 16, borderRadius: Radius.lg + 4, borderWidth: 1 },
  tierRow:      { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tierBadge:    { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tierBadgeText:{ fontFamily: Fonts.displayBold, fontSize: 9 },
  kicker:       { fontFamily: Fonts.mono, fontSize: 9.5, letterSpacing: 0.6, textTransform: 'uppercase' },
  name:         { fontFamily: Fonts.displaySemiBold, fontSize: 18, letterSpacing: -0.45, marginTop: 7 },
  meta:         { fontFamily: Fonts.display, fontSize: 12.5, marginTop: 2 },
  goalPill:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginTop: 9 },
  goalDot:      { width: 5, height: 5, borderRadius: 2.5 },
  goalText:     { fontFamily: Fonts.mono, fontSize: 10.5 },
  rateBtn:      { alignSelf: 'flex-start', borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 9, marginTop: 14 },
  rateText:     { fontFamily: Fonts.displaySemiBold, fontSize: 13.5 },
})
