import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { signInWithGoogle } from '@/services/auth'
import { useUiStore } from '@/stores/uiStore'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useState } from 'react'

export function AccountSection() {
  const tokenSet    = useAuthStore(s => s.tokenSet)
  const setTokenSet = useAuthStore(s => s.setTokenSet)
  const signOut     = useAuthStore(s => s.signOut)
  const clearSchema = useDataStore(s => s.clearSchema)
  const resetPrefs  = useSettingsStore(s => s.setTelegramUser)
  const showToast   = useUiStore(s => s.showToast)
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    setLoading(true)
    try {
      const tokenSet = await signInWithGoogle()
      setTokenSet(tokenSet)
    } catch (e: any) {
      if (e?.message !== 'Auth cancelled') showToast('Inloggen mislukt')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    await clearSchema()
    await resetPrefs('')
    showToast('Uitgelogd')
  }

  if (tokenSet) {
    return (
      <View style={styles.row}>
        <Text style={styles.avatar}>🏃</Text>
        <View style={styles.info}>
          <Text style={styles.email}>{tokenSet.email}</Text>
          <Text style={styles.status}>Google · Ingelogd</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
          <Text style={styles.logoutText}>Uitloggen</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View>
      <Text style={styles.hint}>Log in met Google om je schema te koppelen.</Text>
      <TouchableOpacity
        style={styles.googleBtn}
        onPress={handleSignIn}
        disabled={loading}
      >
        <Text style={styles.googleBtnText}>{loading ? 'Bezig…' : 'Inloggen met Google'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar:       { fontSize: 28 },
  info:         { flex: 1 },
  email:        { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: LightTheme.text },
  status:       { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted, marginTop: 2 },
  logoutBtn:    { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, borderColor: LightTheme.border },
  logoutText:   { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.muted },
  hint:         { fontFamily: Fonts.display, fontSize: 13, color: LightTheme.muted, lineHeight: 20, marginBottom: Spacing.md },
  googleBtn:    { backgroundColor: LightTheme.text, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  googleBtnText:{ fontFamily: Fonts.displaySemiBold, fontSize: 14, color: LightTheme.bg },
})
