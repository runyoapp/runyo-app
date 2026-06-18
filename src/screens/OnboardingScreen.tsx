import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useSettingsStore } from '@/stores/settingsStore'
import { ImportWizard } from '@/screens/import/ImportWizard'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

export function OnboardingScreen() {
  const theme = useTheme()
  const setOnboardingDone = useSettingsStore(s => s.setOnboardingDone)
  const [importOpen, setImportOpen] = useState(false)

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.logo, { color: theme.text }]}>runyo</Text>
      <Text style={[styles.tagline, { color: theme.accent }]}>schema's die meelopen</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: theme.accent }]} onPress={() => setImportOpen(true)}>
          <Text style={styles.btnPrimaryText}>Koppel trainingsschema</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={setOnboardingDone}>
          <Text style={[styles.btnSecondaryText, { color: theme.muted }]}>Eerst verkennen</Text>
        </TouchableOpacity>
      </View>
      <ImportWizard
        visible={importOpen}
        onClose={() => { setImportOpen(false); setOnboardingDone() }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  logo: {
    fontFamily: Fonts.displayBold,
    fontSize: 40,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl * 2,
  },
  actions: { width: '100%', gap: Spacing.md },
  btnPrimary: {
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
  },
})
