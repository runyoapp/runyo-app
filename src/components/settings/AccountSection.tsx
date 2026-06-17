import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { signInWithGoogle } from '@/services/auth'
import { useUiStore } from '@/stores/uiStore'
import { Fonts } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { useState } from 'react'
import { SectionLabel, Card } from './ui'

function GoogleG({ size = 17 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.9 6.8-17.4z" />
      <Path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.8-6.1z" />
      <Path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.4 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </Svg>
  )
}

export function AccountSection() {
  const theme       = useTheme()
  const tokenSet    = useAuthStore(s => s.tokenSet)
  const setTokenSet = useAuthStore(s => s.setTokenSet)
  const signOut     = useAuthStore(s => s.signOut)
  const clearAll    = useDataStore(s => s.clearAll)
  const resetPrefs  = useSettingsStore(s => s.setTelegramUser)
  const showToast   = useUiStore(s => s.showToast)
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    setLoading(true)
    try {
      const set = await signInWithGoogle()
      setTokenSet(set)
    } catch (e: any) {
      if (e?.message !== 'Auth cancelled') showToast('Inloggen mislukt')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    await clearAll()
    await resetPrefs('')
    showToast('Uitgelogd')
  }

  if (tokenSet) {
    const initial = (tokenSet.email?.trim()?.[0] ?? '?').toUpperCase()
    const method  = tokenSet.authMethod === 'google' ? 'Google · ingelogd' : 'E-mail · ingelogd'
    return (
      <View>
        <SectionLabel>Account</SectionLabel>
        <Card style={styles.cardPad}>
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: theme.text }]}>
              <Text style={[styles.avatarText, { color: theme.bg }]}>{initial}</Text>
            </View>
            <View style={styles.info}>
              <Text style={[styles.email, { color: theme.text }]} numberOfLines={1}>{tokenSet.email}</Text>
              <Text style={[styles.status, { color: theme.muted }]}>{method}</Text>
            </View>
            <TouchableOpacity
              style={[styles.logoutBtn, { borderColor: theme.border }]}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <Text style={[styles.logoutText, { color: theme.text2 }]}>Uitloggen</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    )
  }

  return (
    <View>
      <SectionLabel>Account</SectionLabel>
      <Card style={styles.cardPad}>
        <Text style={[styles.title, { color: theme.text }]}>Niet ingelogd</Text>
        <Text style={[styles.hint, { color: theme.muted }]}>
          Log in om je schema's te bewaren en meldingen via Telegram te ontvangen.
        </Text>
        <TouchableOpacity
          style={[styles.googleBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={handleSignIn}
          disabled={loading}
          activeOpacity={0.8}
        >
          <GoogleG />
          <Text style={[styles.googleBtnText, { color: theme.text }]}>
            {loading ? 'Bezig…' : 'Inloggen met Google'}
          </Text>
        </TouchableOpacity>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  cardPad:      { padding: 14 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar:       { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontFamily: Fonts.displayBold, fontSize: 18, letterSpacing: -0.3 },
  info:         { flex: 1, minWidth: 0 },
  email:        { fontFamily: Fonts.displayBold, fontSize: 15.5, letterSpacing: -0.1 },
  status:       { fontFamily: Fonts.mono, fontSize: 11.5, marginTop: 2 },
  logoutBtn:    { borderWidth: 1, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8 },
  logoutText:   { fontFamily: Fonts.displaySemiBold, fontSize: 13 },

  title:        { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.1 },
  hint:         { fontFamily: Fonts.display, fontSize: 12.5, marginTop: 3, lineHeight: 18 },
  googleBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 48, marginTop: 13, borderRadius: 8, borderWidth: 1 },
  googleBtnText:{ fontFamily: Fonts.displaySemiBold, fontSize: 14.5, letterSpacing: -0.1 },
})
