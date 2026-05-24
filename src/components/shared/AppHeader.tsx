import { useState } from 'react'
import { View, TouchableOpacity, Text, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'
import { useTheme } from '@/hooks/useTheme'
import { Logo } from '@/components/shared/Logo'
import { RacesBar } from '@/components/today/RacesBar'
import { StatsModal } from '@/screens/StatsModal'
import { RaceModal } from '@/screens/RaceModal'
import { ModalSheet } from '@/components/shared/ModalSheet'
import { signInWithGoogle } from '@/services/auth'
import { Fonts, Spacing, Radius, LightTheme } from '@/constants/theme'
import type { Activity } from '@/types/activity'

type Props = {
  onAddPress: () => void
  onRacePress?: (datum: string) => void  // optional extra hook, race modal handled internally
  showRacesBar?: boolean
}

export function AppHeader({ onAddPress, onRacePress, showRacesBar = true }: Props) {
  const navigation  = useNavigation()
  const theme       = useTheme()
  const tokenSet    = useAuthStore(s => s.tokenSet)
  const setTokenSet = useAuthStore(s => s.setTokenSet)
  const signOut     = useAuthStore(s => s.signOut)
  const clearSchema = useDataStore(s => s.clearSchema)
  const setTelegram = useSettingsStore(s => s.setTelegramUser)
  const activities  = useDataStore(s => s.activities)

  const loginSheetOpen  = useUiStore(s => s.loginSheetOpen)
  const openLoginSheet  = useUiStore(s => s.openLoginSheet)
  const closeLoginSheet = useUiStore(s => s.closeLoginSheet)

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [statsOpen,    setStatsOpen]    = useState(false)
  const [raceActivity, setRaceActivity] = useState<Activity | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError,   setLoginError]   = useState<string | null>(null)

  async function handleGoogleLogin() {
    setLoginLoading(true)
    setLoginError(null)
    try {
      const ts = await signInWithGoogle()
      setTokenSet(ts)
      closeLoginSheet()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Inloggen mislukt'
      if (msg !== 'Auth cancelled') setLoginError(msg)
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleSignOut() {
    setDropdownOpen(false)
    await signOut()
    await clearSchema()
    await setTelegram('')
  }

  return (
    <View>
      {/* Top header: Logo (wordmark + 60% bar) | + button | avatar */}
      <View style={styles.header}>
        <Logo size={22} />
        <View style={styles.actions}>
          {/* + button only in header on screens without race bar */}
          {!showRacesBar && (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: theme.text }]}
              onPress={onAddPress}
            >
              <Text style={[styles.addBtnText, { color: theme.bg }]}>+</Text>
            </TouchableOpacity>
          )}

          {/* Avatar: surface bg, line border, 8px radius — spec: brand.md §7 */}
          {tokenSet ? (
            <TouchableOpacity
              style={[styles.avatar, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => setDropdownOpen(true)}
            >
              <Text style={[styles.avatarText, { color: theme.text }]}>
                {tokenSet.email?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.signInBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => openLoginSheet()}
            >
              <Text style={[styles.signInText, { color: theme.text }]}>Inloggen</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Race header + add button */}
      {showRacesBar && (
        <>
          <RacesBar
            activities={activities}
            onRacePress={activity => {
              // Parent owns the RaceModal when it provides onRacePress;
              // otherwise fall back to our internal modal. Two stacked
              // <Modal> instances would block touches on Today.
              if (onRacePress) onRacePress(activity.datum)
              else setRaceActivity(activity)
            }}
          />
          <TouchableOpacity style={styles.addBelowBar} onPress={onAddPress}>
            <Text style={[styles.addBelowText, { color: theme.muted }]}>+ Activiteit toevoegen</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Avatar dropdown */}
      <Modal visible={dropdownOpen} transparent animationType="fade" onRequestClose={() => setDropdownOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setDropdownOpen(false)}>
          <View style={[styles.dropdown, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.dropdownEmail, { borderBottomColor: theme.border }]}>
              <Text style={[styles.dropdownEmailText, { color: theme.muted }]} numberOfLines={1}>
                {tokenSet?.email}
              </Text>
            </View>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => { setDropdownOpen(false); setStatsOpen(true) }}>
              <Text style={[styles.dropdownLabel, { color: theme.text }]}>Statistieken & PR's</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => { setDropdownOpen(false); navigation.navigate('Settings' as never) }}>
              <Text style={[styles.dropdownLabel, { color: theme.text }]}>Instellingen</Text>
            </TouchableOpacity>
            <View style={[styles.dropdownDivider, { backgroundColor: theme.border }]} />
            <TouchableOpacity style={styles.dropdownItem} onPress={handleSignOut}>
              <Text style={[styles.dropdownLabel, { color: theme.danger }]}>Uitloggen</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <StatsModal visible={statsOpen} onClose={() => setStatsOpen(false)} />
      <RaceModal activity={raceActivity} visible={!!raceActivity} onClose={() => setRaceActivity(null)} />

      {/* Inline login sheet — U37: app browsebaar zonder login */}
      <ModalSheet visible={loginSheetOpen} title="Inloggen" onClose={() => { closeLoginSheet(); setLoginError(null) }}>
        {loginError !== null && (
          <View style={styles.loginError}>
            <Text style={styles.loginErrorText}>Inloggen mislukt. Controleer je verbinding en probeer opnieuw.</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.loginBtn, { backgroundColor: theme.accent }]}
          onPress={handleGoogleLogin}
          disabled={loginLoading}
          activeOpacity={0.8}
        >
          {loginLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.loginBtnText}>
                {loginError !== null ? 'Opnieuw inloggen met Google' : 'Inloggen met Google'}
              </Text>
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.loginBtnSecondary, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => { closeLoginSheet(); navigation.navigate('EmailAuth' as never) }}
          disabled={loginLoading}
          activeOpacity={0.8}
        >
          <Text style={[styles.loginBtnSecondaryText, { color: theme.text }]}>Inloggen met e-mail</Text>
        </TouchableOpacity>
      </ModalSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  actions:           { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  addBtn:            { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  addBtnText:        { fontFamily: Fonts.displaySemiBold, fontSize: 20, lineHeight: 24 },
  avatar:            { width: 32, height: 32, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText:        { fontFamily: Fonts.displayBold, fontSize: 13 },
  signInBtn:         { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill, borderWidth: 1 },
  signInText:        { fontFamily: Fonts.displayMedium, fontSize: 13 },
  addBelowBar:       { marginHorizontal: Spacing.lg, marginBottom: 4, paddingVertical: 4, alignSelf: 'flex-start' },
  addBelowText:      { fontFamily: Fonts.displayMedium, fontSize: 13 },
  loginError:        { backgroundColor: 'rgba(220,60,60,0.08)', borderRadius: Radius.md, padding: Spacing.md },
  loginErrorText:    { fontFamily: Fonts.display, fontSize: 13, color: '#C0392B', textAlign: 'center' },
  loginBtn:          { borderRadius: Radius.md, padding: Spacing.lg, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  loginBtnText:      { fontFamily: Fonts.displaySemiBold, fontSize: 16, color: '#fff' },
  loginBtnSecondary: { borderRadius: Radius.md, padding: Spacing.lg, alignItems: 'center', minHeight: 52, justifyContent: 'center', borderWidth: 1 },
  loginBtnSecondaryText: { fontFamily: Fonts.displaySemiBold, fontSize: 16 },
  overlay:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
  dropdown:          { position: 'absolute', top: 60, right: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, minWidth: 200, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8, overflow: 'hidden' },
  dropdownEmail:     { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  dropdownEmailText: { fontFamily: Fonts.mono, fontSize: 11 },
  dropdownItem:      { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  dropdownLabel:     { fontFamily: Fonts.displayMedium, fontSize: 14 },
  dropdownDivider:   { height: 1, marginVertical: 2 },
})
