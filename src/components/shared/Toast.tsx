import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUiStore } from '@/stores/uiStore'
import { LightTheme, Fonts, Radius, Spacing } from '@/constants/theme'

export function Toast() {
  const toast  = useUiStore(s => s.toast)
  const insets = useSafeAreaInsets()

  if (!toast) return null

  return (
    <View style={[styles.container, { bottom: insets.bottom + 80 }]}>
      <Text style={styles.text}>{toast}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: LightTheme.text,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    maxWidth: '80%',
    zIndex: 999,
  },
  text: {
    fontFamily: Fonts.displayMedium,
    fontSize: 13,
    color: LightTheme.bg,
    textAlign: 'center',
  },
})
