import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { signInWithEmail, signUpWithEmail } from '@/services/auth'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

export function EmailAuthScreen() {
  const theme       = useTheme()
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
      style={[styles.flex, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: theme.text }]}>{isSignup ? 'Account aanmaken' : 'Inloggen'}</Text>

        <View style={styles.form}>
          <Text style={[styles.label, { color: theme.muted }]}>E-mailadres</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={email}
            onChangeText={setEmail}
            placeholder="jij@voorbeeld.nl"
            placeholderTextColor={theme.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
          />

          <Text style={[styles.label, { color: theme.muted, marginTop: Spacing.md }]}>Wachtwoord</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={password}
            onChangeText={setPassword}
            placeholder={isSignup ? 'Minimaal 10 tekens' : 'Wachtwoord'}
            placeholderTextColor={theme.faint}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.accent }, loading && styles.btnDisabled]}
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
          <Text style={[styles.toggleText, { color: theme.muted }]}>
            {isSignup ? 'Al een account? ' : 'Nog geen account? '}
            <Text style={[styles.toggleLink, { color: theme.accent }]}>{isSignup ? 'Inloggen' : 'Aanmaken'}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.displayBold,
    fontSize: 28,
    marginBottom: Spacing.xxl,
    letterSpacing: -0.5,
  },
  form: {
    gap: Spacing.xs,
  },
  label: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 13,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontFamily: Fonts.display,
    fontSize: 16,
  },
  error: {
    fontFamily: Fonts.display,
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  btn: {
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
  },
  toggleLink: {
    fontFamily: Fonts.displaySemiBold,
  },
})
