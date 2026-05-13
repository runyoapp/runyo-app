import { View, Text, StyleSheet } from 'react-native'
import { LightTheme, Fonts } from '@/constants/theme'

export function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Settings — Phase 9</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LightTheme.bg, alignItems: 'center', justifyContent: 'center' },
  placeholder: { fontFamily: Fonts.mono, fontSize: 14, color: LightTheme.muted },
})
