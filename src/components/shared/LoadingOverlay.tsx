import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { LightTheme, Fonts } from '@/constants/theme'

type Props = { message?: string }

export function LoadingOverlay({ message }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>runyo</Text>
      <ActivityIndicator color={LightTheme.accent} style={styles.spinner} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LightTheme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontFamily: Fonts.displayBold,
    fontSize: 32,
    color: LightTheme.text,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  spinner: { marginBottom: 12 },
  message: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: LightTheme.muted,
  },
})
