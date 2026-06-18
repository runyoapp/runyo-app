import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuthStore } from '@/stores/authStore'
import { signInWithGoogle } from '@/services/auth'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import type { RootStackParamList } from '@/navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function LoginScreen() {
  const theme       = useTheme()
  const setTokenSet = useAuthStore(s => s.setTokenSet)
  const navigation  = useNavigation<Nav>()
  const [loading,      setLoading]      = useState<'google' | 'none'>('none')
  const [authError,    setAuthError]    = useState<string | null>(null)

  async function handleGoogle() {
    setLoading('google')
    setAuthError(null)
    try {
      const tokenSet = await signInWithGoogle()
      setTokenSet(tokenSet)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Inloggen mislukt'
      if (msg !== 'Auth cancelled') setAuthError(msg)
    } finally {
      setLoading('none')
    }
  }

  function handleEmail() {
    navigation.navigate('EmailAuth')
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.logo, { color: theme.text }]}>runyo</Text>
      <Text style={[styles.tagline, { color: theme.accent }]}>schema's die meelopen</Text>

      {authError !== null && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Inloggen mislukt. Controleer je verbinding en probeer opnieuw.</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnGoogle, { backgroundColor: theme.accent }]}
          onPress={handleGoogle}
          disabled={loading !== 'none'}
          activeOpacity={0.8}
        >
          {loading === 'google'
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnGoogleText}>
                {authError !== null ? 'Opnieuw inloggen met Google' : 'Inloggen met Google'}
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnApple, { backgroundColor: theme.surface, borderColor: theme.border }]}
          disabled
          activeOpacity={0.8}
        >
          <Text style={[styles.btnAppleText, { color: theme.text }]}>Inloggen met Apple</Text>
          <Text style={[styles.btnAppleSoon, { color: theme.muted }]}> · binnenkort</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnEmail, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={handleEmail}
          disabled={loading !== 'none'}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnEmailText, { color: theme.text }]}>Inloggen met e-mail</Text>
        </TouchableOpacity>
      </View>
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
  errorBox: {
    backgroundColor: 'rgba(220,60,60,0.08)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    width: '100%',
  },
  errorText: {
    fontFamily: Fonts.display,
    fontSize: 13,
    color: '#C0392B',
    textAlign: 'center',
  },
  tagline: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl * 2,
  },
  actions: {
    width: '100%',
    gap: Spacing.md,
  },
  btn: {
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnGoogle: {
  },
  btnGoogleText: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    color: '#fff',
  },
  btnApple: {
    borderWidth: 1,
    opacity: 0.5,
  },
  btnAppleText: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
  },
  btnAppleSoon: {
    fontFamily: Fonts.display,
    fontSize: 13,
  },
  btnEmail: {
    borderWidth: 1,
  },
  btnEmailText: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
  },
})
