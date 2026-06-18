import { View, Text, StyleSheet } from 'react-native'
import { Fonts, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { useWeather } from '@/hooks/useWeather'

export function WeatherWidget() {
  const theme = useTheme()
  const today = useWeather()
  if (!today) return null

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{today.emoji}</Text>
      <Text style={[styles.temp, { color: theme.text }]}>{today.tempMax}°</Text>
      <Text style={[styles.range, { color: theme.muted }]}>{today.tempMin}° – {today.tempMax}°</Text>
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
})
