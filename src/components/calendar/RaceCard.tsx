import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { raceCountdown as countdown } from '@/utils/date'
import type { Activity } from '@/types/activity'

type Props = {
  race: Activity
  onPress: () => void
}

export function RaceCard({ race, onPress }: Props) {
  const cd = countdown(race.datum)
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.icon}>🏁</Text>
      <View style={styles.body}>
        <Text style={styles.label}>Race</Text>
        <Text style={styles.title}>{race.titel || race.datum}</Text>
        {race.km != null && <Text style={styles.km}>{race.km} km</Text>}
      </View>
      <View style={styles.countdown}>
        <Text style={styles.countdownVal}>{cd.val}</Text>
        <Text style={styles.countdownUnit}>{cd.unit}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card:          { flexDirection: 'row', alignItems: 'center', backgroundColor: LightTheme.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: 6, gap: Spacing.md },
  icon:          { fontSize: 24 },
  body:          { flex: 1, minWidth: 0 },
  label:         { fontFamily: Fonts.displayMedium, fontSize: 11, color: '#C8336B', textTransform: 'uppercase', marginBottom: 2 },
  title:         { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: LightTheme.text },
  km:            { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted, marginTop: 2 },
  countdown:     { alignItems: 'flex-end' },
  countdownVal:  { fontFamily: Fonts.displayBold, fontSize: 22, color: LightTheme.text, letterSpacing: -0.5, lineHeight: 26 },
  countdownUnit: { fontFamily: Fonts.display, fontSize: 11, color: LightTheme.muted },
})
