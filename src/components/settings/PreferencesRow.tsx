import { View, Text, StyleSheet } from 'react-native'
import { useSettingsStore } from '@/stores/settingsStore'
import { Fonts } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { SegTrack, SegCell, SunGlyph, MoonGlyph } from './ui'

// Compacte pill-rij: taal (NL/EN) + thema (zon/maan) — vervangt de oude
// volledige "Voorkeuren"-sectie. Schrijft direct naar settingsStore.prefs.
export function PreferencesRow() {
  const theme    = useTheme()
  const lang     = useSettingsStore(s => s.prefs.lang)
  const themePref = useSettingsStore(s => s.prefs.theme)
  const setPrefs = useSettingsStore(s => s.setPrefs)

  return (
    <View style={styles.row}>
      <SegTrack>
        {(['nl', 'en'] as const).map(o => (
          <SegCell key={o} active={lang === o} onPress={() => setPrefs({ lang: o })}>
            <Text style={[styles.langText, { color: lang === o ? theme.accentInk : theme.muted }]}>
              {o.toUpperCase()}
            </Text>
          </SegCell>
        ))}
      </SegTrack>

      <SegTrack>
        <SegCell active={themePref === 'light'} onPress={() => setPrefs({ theme: 'light' })}>
          <SunGlyph active={themePref === 'light'} />
        </SegCell>
        <SegCell active={themePref === 'dark'} onPress={() => setPrefs({ theme: 'dark' })}>
          <MoonGlyph active={themePref === 'dark'} />
        </SegCell>
      </SegTrack>
    </View>
  )
}

const styles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 18 },
  langText: { fontFamily: Fonts.monoMedium, fontSize: 12, letterSpacing: 0.3 },
})
