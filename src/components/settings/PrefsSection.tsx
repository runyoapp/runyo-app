import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSettingsStore } from '@/stores/settingsStore'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

export function PrefsSection() {
  const prefs    = useSettingsStore(s => s.prefs)
  const setPrefs = useSettingsStore(s => s.setPrefs)

  return (
    <View style={styles.container}>
      {/* Language */}
      <Text style={styles.label}>Taal</Text>
      <View style={styles.toggleGroup}>
        {(['nl', 'en'] as const).map(lang => (
          <TouchableOpacity
            key={lang}
            style={[styles.toggleBtn, prefs.lang === lang && styles.toggleBtnActive]}
            onPress={() => setPrefs({ lang })}
          >
            <Text style={[styles.toggleBtnText, prefs.lang === lang && styles.toggleBtnTextActive]}>
              {lang === 'nl' ? '🇳🇱 Nederlands' : '🇬🇧 English'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Theme */}
      <Text style={[styles.label, { marginTop: Spacing.md }]}>Thema</Text>
      <View style={styles.toggleGroup}>
        {(['light', 'dark'] as const).map(theme => (
          <TouchableOpacity
            key={theme}
            style={[styles.toggleBtn, prefs.theme === theme && styles.toggleBtnActive]}
            onPress={() => setPrefs({ theme })}
          >
            <Text style={[styles.toggleBtnText, prefs.theme === theme && styles.toggleBtnTextActive]}>
              {theme === 'light' ? '☀️ Licht' : '🌙 Donker'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:          { gap: Spacing.sm },
  label:              { fontFamily: Fonts.displaySemiBold, fontSize: 13, color: LightTheme.text },
  toggleGroup:        { flexDirection: 'row', gap: Spacing.sm },
  toggleBtn:          { flex: 1, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', backgroundColor: LightTheme.surface, borderWidth: 1, borderColor: LightTheme.border },
  toggleBtnActive:    { backgroundColor: LightTheme.accent, borderColor: LightTheme.accent },
  toggleBtnText:      { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.muted },
  toggleBtnTextActive:{ color: '#fff' },
})
