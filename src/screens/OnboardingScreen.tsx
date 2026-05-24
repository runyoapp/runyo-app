import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useSettingsStore } from '@/stores/settingsStore'
import { ImportModal } from '@/screens/ImportModal'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'

export function OnboardingScreen() {
  const setOnboardingDone = useSettingsStore(s => s.setOnboardingDone)
  const [importOpen, setImportOpen] = useState(false)

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>runyo</Text>
      <Text style={styles.tagline}>schema's die meelopen</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => setImportOpen(true)}>
          <Text style={styles.btnPrimaryText}>Koppel trainingsschema</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={setOnboardingDone}>
          <Text style={styles.btnSecondaryText}>Eerst verkennen</Text>
        </TouchableOpacity>
      </View>
      <ImportModal
        visible={importOpen}
        onClose={() => { setImportOpen(false); setOnboardingDone() }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LightTheme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  logo: {
    fontFamily: Fonts.displayBold,
    fontSize: 40,
    color: LightTheme.text,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: LightTheme.accent,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl * 2,
  },
  actions: { width: '100%', gap: Spacing.md },
  btnPrimary: {
    backgroundColor: LightTheme.accent,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    color: '#fff',
  },
  btnSecondary: {
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontFamily: Fonts.display,
    fontSize: 15,
    color: LightTheme.muted,
  },
})
