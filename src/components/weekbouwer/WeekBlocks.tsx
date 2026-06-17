import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { ActivityColors, Fonts } from '@/constants/theme'
import type { PlanWeekData } from '@/components/plan/PlanWeek'

type Props = {
  weeks: PlanWeekData[]
  activeMonday: string
  onPickWeek: (monday: string) => void
}

const BAR_MAX_H = 64

// Inline blokken-grafiek over de hele schema-looptijd: één staaf per week.
// Hoogte = goalKm genormaliseerd; kleur = mint-intensiteit op km (donkerder =
// meer volume), raceweek = rood. Actieve week = outline. Tik = spring erheen.
export function WeekBlocks({ weeks, activeMonday, onPickWeek }: Props) {
  const theme = useTheme()
  const maxKm = weeks.reduce((m, w) => Math.max(m, w.goalKm), 0) || 1
  const hex   = theme.accent.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)

  return (
    <View style={styles.chart}>
      {weeks.map(w => {
        const frac    = w.goalKm / maxKm
        const h       = Math.max(4, frac * BAR_MAX_H)
        const current = w.monday === activeMonday
        // Mint-intensiteit: 0.35 (laag) → 1 (hoog) op km.
        const opacity = 0.35 + frac * 0.65
        const color = w.hasRace
          ? ActivityColors.race.text
          : `rgba(${r}, ${g}, ${b}, ${opacity})`

        return (
          <TouchableOpacity
            key={w.monday}
            style={styles.barCol}
            activeOpacity={0.7}
            onPress={() => onPickWeek(w.monday)}
          >
            <Text style={[styles.barKm, { color: current ? theme.text : 'transparent' }]}>
              {w.goalKm}
            </Text>
            <View
              style={[
                styles.bar,
                {
                  height: h,
                  backgroundColor: color,
                  borderWidth: current ? 2 : 0,
                  borderColor: current ? theme.text : 'transparent',
                },
              ]}
            />
            <Text style={[styles.barNum, {
              color: current ? theme.text : theme.muted,
              fontFamily: current ? Fonts.monoMedium : Fonts.mono,
            }]}>
              {w.num}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  chart:  { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 96 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barKm:  { fontFamily: Fonts.mono, fontSize: 8, fontWeight: '700' },
  bar:    { width: '100%', borderRadius: 4 },
  barNum: { fontSize: 8 },
})
