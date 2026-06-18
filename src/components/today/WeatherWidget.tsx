import { View, Text, StyleSheet } from 'react-native'
import { Fonts, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { useWeather } from '@/hooks/useWeather'
import type { WeatherDay } from '@/services/weather'

// Korte loopweer-duiding op basis van weercode + temperatuur (open-meteo WMO-codes).
function runningNote(d: WeatherDay): string {
  const c = d.code
  if (c >= 95) return 'onweer — kies je moment'
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'sneeuw — pas op gladheid'
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'regenjasje mee'
  if (d.tempMax >= 25) return 'warm — neem water mee'
  if (d.tempMax <= 2)  return 'ijzig — laagjes aan'
  if (d.tempMax >= 8 && d.tempMax <= 18) return 'ideaal loopweer'
  return 'prima loopweer'
}

export function WeatherWidget() {
  const theme = useTheme()
  const today = useWeather()
  if (!today) return null

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{today.emoji}</Text>
      <Text style={[styles.temp, { color: theme.text }]}>{today.tempMax}°</Text>
      <Text style={[styles.range, { color: theme.muted }]}>{today.tempMin}° – {today.tempMax}°</Text>
      <Text style={[styles.note, { color: theme.accent }]}>· {runningNote(today)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  emoji: { fontSize: 18 },
  temp: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 15,
  },
  range: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  note: {
    fontFamily: Fonts.displayMedium,
    fontSize: 12,
    letterSpacing: -0.1,
  },
})
