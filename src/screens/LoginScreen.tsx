import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuthStore } from '@/stores/authStore'
import { signInWithGoogle } from '@/services/auth'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import type { RootStackParamList } from '@/navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function LoginScreen() {
  const setTokenSet = useAuthStore(s => s.setTokenSet)
  const navigation  = useNavigation<Nav>()
  const [loading, setLoading] = useState<'google' | 'none'>('none')

  async function handleGoogle() {
    setLoading('google')
    try {
      const tokenSet = await signInWithGoogle()
      setTokenSet(tokenSet)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Inloggen mislukt'
      if (msg !== 'Auth cancelled') Alert.alert('Inloggen mislukt', msg)
    } finally {
      setLoading('none')
    }
  }

  function handleEmail() {
    navigation.navigate('EmailAuth')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>runyo</Text>
      <Text style={styles.tagline}>schema's die meelopen</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnGoogle]}
          onPress={handleGoogle}
          disabled={loading !== 'none'}
          activeOpacity={0.8}
        >
          {loading === 'google'
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnGoogleText}>Inloggen met Google</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnApple]}
          disabled
          activeOpacity={0.8}
        >
          <Text style={styles.btnAppleText}>Inloggen met Apple</Text>
          <Text style={styles.btnAppleSoon}> · binnenkort</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnEmail]}
          onPress={handleEmail}
          disabled={loading !== 'none'}
          activeOpacity={0.8}
        >
          <Text style={styles.btnEmailText}>Inloggen met e-mail</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LightTheme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  logo: {
    fontFamily: Fonts.displayBold,
    fontSize: 40,
    color: LightTheme.text,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: LightTheme.accent,
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
    backgroundColor: LightTheme.accent,
  },
  btnGoogleText: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    color: '#fff',
  },
  btnApple: {
    backgroundColor: LightTheme.surface,
    borderWidth: 1,
    borderColor: LightTheme.border,
    opacity: 0.5,
  },
  btnAppleText: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    color: LightTheme.text,
  },
  btnAppleSoon: {
    fontFamily: Fonts.display,
    fontSize: 13,
    color: LightTheme.muted,
  },
  btnEmail: {
    backgroundColor: LightTheme.surface,
    borderWidth: 1,
    borderColor: LightTheme.border,
  },
  btnEmailText: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    color: LightTheme.text,
  },
})
