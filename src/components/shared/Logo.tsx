import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Fonts } from '@/constants/theme'

// Canonical Logo: wordmark + 60% mint progress bar. ALWAYS 60% — never varies.
// ref: runyo-v2.jsx Logo component
const PROGRESS = 0.6

type Props = { size?: number }

export function Logo({ size = 22 }: Props) {
  const theme  = useTheme()
  const barH   = Math.max(2, Math.round(size * 0.045 * 10) / 10)
  const barMt  = Math.round(size * 0.12)

  return (
    <View>
      <Text style={[styles.wordmark, { fontSize: size, color: theme.text }]}>
        runyo
      </Text>
      <View style={[styles.track, { height: barH, marginTop: barMt, backgroundColor: theme.border }]}>
        <View style={[styles.fill, { width: `${PROGRESS * 100}%`, backgroundColor: theme.accent }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wordmark: {
    fontFamily: Fonts.displayBold,
    letterSpacing: -0.8,
    lineHeight: 1.1 * 22,  // overridden by fontSize inline
  },
  track: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
})
