import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { RacesBar } from '@/components/today/RacesBar'
import { LightTheme, Fonts, Spacing } from '@/constants/theme'
import type { Activity } from '@/types/activity'

type Props = {
  onAddPress: () => void
  onRacePress?: (datum: string) => void
  selectedActivity?: Activity | null
  setSelectedActivity?: (a: Activity | null) => void
  showRacesBar?: boolean
}

export function AppHeader({ onAddPress, onRacePress, showRacesBar = true }: Props) {
  const navigation = useNavigation()
  const tokenSet   = useAuthStore(s => s.tokenSet)
  const activities = useDataStore(s => s.activities)

  function handleRacePress(datum: string) {
    if (onRacePress) onRacePress(datum)
  }

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.logo}>runyo</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.addBtn} onPress={onAddPress}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
          {tokenSet ? (
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => navigation.navigate('Settings' as never)}
            >
              <Text style={styles.avatarText}>
                {tokenSet.email?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.signInBtn}
              onPress={() => navigation.navigate('Settings' as never)}
            >
              <Text style={styles.signInText}>Inloggen</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showRacesBar && (
        <RacesBar
          activities={activities}
          onRacePress={handleRacePress}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  logo:        { fontFamily: Fonts.displayBold, fontSize: 22, color: LightTheme.text, letterSpacing: -0.5 },
  actions:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  addBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: LightTheme.surface, borderWidth: 1, borderColor: LightTheme.border, alignItems: 'center', justifyContent: 'center' },
  addBtnText:  { fontFamily: Fonts.displayBold, fontSize: 20, color: LightTheme.text, lineHeight: 24 },
  avatar:      { width: 32, height: 32, borderRadius: 16, backgroundColor: LightTheme.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontFamily: Fonts.displayBold, fontSize: 14, color: LightTheme.accentInk },
  signInBtn:   { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: 999, borderWidth: 1, borderColor: LightTheme.border, backgroundColor: LightTheme.surface },
  signInText:  { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.text },
})
