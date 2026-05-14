import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSettingsStore } from '@/stores/settingsStore'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

// No emoji — brand rule #4. Use text labels only.
const LANG_LABELS = { nl: 'NL · Nederlands', en: 'EN · English' } as const
const THEME_LABELS = { light: 'Licht', dark: 'Donker' } as const

export function PrefsSection() {
  const theme    = useTheme()
  const prefs    = useSettingsStore(s => s.prefs)
  const setPrefs = useSettingsStore(s => s.setPrefs)

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.text }]}>Taal</Text>
      <View style={styles.toggleGroup}>
        {(['nl', 'en'] as const).map(lang => (
          <TouchableOpacity
            key={lang}
            style={[
              styles.toggleBtn,
              { backgroundColor: theme.surface, borderColor: theme.border },
              prefs.lang === lang && { backgroundColor: theme.accent, borderColor: theme.accent },
            ]}
            onPress={() => setPrefs({ lang })}
          >
            <Text style={[
              styles.toggleBtnText,
              { color: theme.muted },
              prefs.lang === lang && { color: theme.accentInk, fontFamily: Fonts.displaySemiBold },
            ]}>
              {LANG_LABELS[lang]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: theme.text, marginTop: Spacing.md }]}>Thema</Text>
      <View style={styles.toggleGroup}>
        {(['light', 'dark'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[
              styles.toggleBtn,
              { backgroundColor: theme.surface, borderColor: theme.border },
              prefs.theme === t && { backgroundColor: theme.accent, borderColor: theme.accent },
            ]}
            onPress={() => setPrefs({ theme: t })}
          >
            <Text style={[
              styles.toggleBtnText,
              { color: theme.muted },
              prefs.theme === t && { color: theme.accentInk, fontFamily: Fonts.displaySemiBold },
            ]}>
              {THEME_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { gap: Spacing.sm },
  label:        { fontFamily: Fonts.displaySemiBold, fontSize: 13 },
  toggleGroup:  { flexDirection: 'row', gap: Spacing.sm },
  toggleBtn:    { flex: 1, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1 },
  toggleBtnText:{ fontFamily: Fonts.displayMedium, fontSize: 13 },
})
