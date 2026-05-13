import { View, Text, StyleSheet } from 'react-native'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useWeather } from '@/hooks/useWeather'

export function WeatherWidget() {
  const today = useWeather()
  if (!today) return null

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{today.emoji}</Text>
      <Text style={styles.temp}>{today.tempMax}°</Text>
      <Text style={styles.range}>{today.tempMin}° – {today.tempMax}°</Text>
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
    color: LightTheme.text,
  },
  range: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: LightTheme.muted,
  },
})
