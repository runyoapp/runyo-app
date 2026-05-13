import { useSettingsStore } from '@/stores/settingsStore'
import { LightTheme, DarkTheme, type Theme } from '@/constants/theme'

export function useTheme(): Theme {
  const themePref = useSettingsStore(s => s.prefs.theme)
  return themePref === 'dark' ? DarkTheme : LightTheme
}
