import { View, Text, StyleSheet } from 'react-native'
import { LightTheme, Fonts } from '@/constants/theme'

export function TodayScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Today — Phase 5</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LightTheme.bg, alignItems: 'center', justifyContent: 'center' },
  placeholder: { fontFamily: Fonts.mono, fontSize: 14, color: LightTheme.muted },
})
