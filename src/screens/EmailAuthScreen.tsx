import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { signInWithEmail, signUpWithEmail } from '@/services/auth'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'

export function EmailAuthScreen() {
  const setTokenSet = useAuthStore(s => s.setTokenSet)
  const [mode, setMode]           = useState<'signin' | 'signup'>('signin')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    const e = email.trim()
    const p = password

    if (!e || !p) {
      setError('Vul e-mailadres en wachtwoord in')
      return
    }

    setLoading(true)
    try {
      const tokenSet = mode === 'signup'
        ? await signUpWithEmail(e, p)
        : await signInWithEmail(e, p)
      setTokenSet(tokenSet)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Er ging iets mis'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function toggleMode() {
    setMode(m => m === 'signin' ? 'signup' : 'signin')
    setError(null)
  }

  const isSignup = mode === 'signup'

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{isSignup ? 'Account aanmaken' : 'Inloggen'}</Text>

        <View style={styles.form}>
          <Text style={styles.label}>E-mailadres</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="jij@voorbeeld.nl"
            placeholderTextColor={LightTheme.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
          />

          <Text style={[styles.label, { marginTop: Spacing.md }]}>Wachtwoord</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={isSignup ? 'Minimaal 10 tekens' : 'Wachtwoord'}
            placeholderTextColor={LightTheme.faint}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{isSignup ? 'Account aanmaken' : 'Inloggen'}</Text>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={toggleMode} style={styles.toggle}>
          <Text style={styles.toggleText}>
            {isSignup ? 'Al een account? ' : 'Nog geen account? '}
            <Text style={styles.toggleLink}>{isSignup ? 'Inloggen' : 'Aanmaken'}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: LightTheme.bg,
  },
  container: {
    flexGrow: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.displayBold,
    fontSize: 28,
    color: LightTheme.text,
    marginBottom: Spacing.xxl,
    letterSpacing: -0.5,
  },
  form: {
    gap: Spacing.xs,
  },
  label: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 13,
    color: LightTheme.muted,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: LightTheme.surface,
    borderWidth: 1,
    borderColor: LightTheme.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontFamily: Fonts.display,
    fontSize: 16,
    color: LightTheme.text,
  },
  error: {
    fontFamily: Fonts.display,
    fontSize: 14,
    color: LightTheme.danger,
    marginTop: Spacing.sm,
  },
  btn: {
    backgroundColor: LightTheme.accent,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.lg,
    minHeight: 52,
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    color: '#fff',
  },
  toggle: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  toggleText: {
    fontFamily: Fonts.display,
    fontSize: 14,
    color: LightTheme.muted,
  },
  toggleLink: {
    color: LightTheme.accent,
    fontFamily: Fonts.displaySemiBold,
  },
})
