import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { RacesBar } from '@/components/today/RacesBar'
import { StatsModal } from '@/screens/StatsModal'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import type { Activity } from '@/types/activity'

type Props = {
  onAddPress: () => void
  onRacePress?: (datum: string) => void
  showRacesBar?: boolean
}

export function AppHeader({ onAddPress, onRacePress, showRacesBar = true }: Props) {
  const navigation   = useNavigation()
  const theme        = useTheme()
  const tokenSet     = useAuthStore(s => s.tokenSet)
  const signOut      = useAuthStore(s => s.signOut)
  const clearSchema  = useDataStore(s => s.clearSchema)
  const setTelegram  = useSettingsStore(s => s.setTelegramUser)
  const activities   = useDataStore(s => s.activities)

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [statsOpen,    setStatsOpen]    = useState(false)

  async function handleSignOut() {
    setDropdownOpen(false)
    await signOut()
    await clearSchema()
    await setTelegram('')
  }

  return (
    <View style={{ backgroundColor: theme.bg }}>
      <View style={styles.header}>
        <Text style={styles.logo}>runyo</Text>
        <View style={styles.actions}>
          {!showRacesBar && (
            <TouchableOpacity style={styles.addBtn} onPress={onAddPress}>
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          )}
          {tokenSet ? (
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => setDropdownOpen(true)}
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
        <>
          <RacesBar
            activities={activities}
            onRacePress={datum => onRacePress?.(datum)}
          />
          <TouchableOpacity style={styles.addBelowBar} onPress={onAddPress}>
            <Text style={styles.addBelowText}>+ Activiteit toevoegen</Text>
          </TouchableOpacity>
        </>
      )}
      {!showRacesBar && null}

      {/* Avatar dropdown */}
      <Modal
        visible={dropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setDropdownOpen(false)}>
          <View style={[styles.dropdown, { backgroundColor: theme.surface }]}>
            <View style={styles.dropdownEmail}>
              <Text style={styles.dropdownEmailText} numberOfLines={1}>{tokenSet?.email}</Text>
            </View>

            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => { setDropdownOpen(false); setStatsOpen(true) }}
            >
              <Text style={styles.dropdownIcon}>📊</Text>
              <Text style={styles.dropdownLabel}>Statistieken & PR's</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => { setDropdownOpen(false); navigation.navigate('Settings' as never) }}
            >
              <Text style={styles.dropdownIcon}>⚙️</Text>
              <Text style={styles.dropdownLabel}>Instellingen</Text>
            </TouchableOpacity>

            <View style={styles.dropdownDivider} />

            <TouchableOpacity style={styles.dropdownItem} onPress={handleSignOut}>
              <Text style={styles.dropdownIcon}>↩️</Text>
              <Text style={[styles.dropdownLabel, styles.dropdownDanger]}>Uitloggen</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <StatsModal visible={statsOpen} onClose={() => setStatsOpen(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  logo:              { fontFamily: Fonts.displayBold, fontSize: 22, color: LightTheme.text, letterSpacing: -0.5 },
  actions:           { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  addBtn:            { width: 32, height: 32, borderRadius: 16, backgroundColor: LightTheme.surface, borderWidth: 1, borderColor: LightTheme.border, alignItems: 'center', justifyContent: 'center' },
  addBtnText:        { fontFamily: Fonts.displayBold, fontSize: 20, color: LightTheme.text, lineHeight: 24 },
  addBelowBar:       { marginHorizontal: 16, marginBottom: 4, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start' },
  addBelowText:      { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.muted },
  avatar:            { width: 32, height: 32, borderRadius: 16, backgroundColor: LightTheme.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText:        { fontFamily: Fonts.displayBold, fontSize: 14, color: LightTheme.accentInk },
  signInBtn:         { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: 999, borderWidth: 1, borderColor: LightTheme.border, backgroundColor: LightTheme.surface },
  signInText:        { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.text },

  overlay:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
  dropdown:          { position: 'absolute', top: 60, right: Spacing.lg, backgroundColor: LightTheme.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: LightTheme.border, minWidth: 200, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8, overflow: 'hidden' },
  dropdownEmail:     { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: LightTheme.border },
  dropdownEmailText: { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted },
  dropdownItem:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  dropdownIcon:      { fontSize: 16, width: 22 },
  dropdownLabel:     { fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text },
  dropdownDivider:   { height: 1, backgroundColor: LightTheme.border, marginVertical: 2 },
  dropdownDanger:    { color: '#C8336B' },
})
