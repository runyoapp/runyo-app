import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUiStore } from '@/stores/uiStore'
import { Fonts, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

export function Toast() {
  const toast       = useUiStore(s => s.toast)
  const toastAction = useUiStore(s => s.toastAction)
  const hideToast   = useUiStore(s => s.hideToast)
  const insets      = useSafeAreaInsets()
  const theme       = useTheme()

  if (!toast) return null

  return (
    <View style={[styles.container, { bottom: insets.bottom + 80, backgroundColor: theme.text }]}>
      <Text style={[styles.text, { color: theme.bg }]}>{toast}</Text>
      {toastAction && (
        <TouchableOpacity
          onPress={() => { toastAction.onPress(); hideToast() }}
          style={styles.actionBtn}
        >
          <Text style={[styles.actionText, { color: theme.accent }]}>{toastAction.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    maxWidth: '88%',
    zIndex: 999,
  },
  text: {
    fontFamily: Fonts.displayMedium,
    fontSize: 13,
  },
  actionBtn: {
    paddingLeft: Spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(241,238,230,0.25)',
  },
  actionText: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 13,
  },
})
