import * as WebBrowser from 'expo-web-browser'
import * as Crypto from 'expo-crypto'
import * as SecureStore from './storage'
import { Platform } from 'react-native'
import type { TokenSet } from '@/types/auth'

const CLIENT_ID   = '360342745908-n5l0071jgfb76nn0qtj65d9rcmolgbqf.apps.googleusercontent.com'
export const BACKEND = 'https://runyo-auth-production.up.railway.app'
const REDIRECT_URI = 'https://app.runyo.app/oauth-callback.html'
const DEEP_LINK   = 'runyo://auth'

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ')

const KEYS = {
  token:    'gauth_token',
  expiry:   'gauth_expiry',
  refresh:  'gauth_refresh',
  email:    'gauth_email',
}

// PKCE helpers
async function generateVerifier(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  )
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Main sign-in — opens SFSafariViewController (native) or popup (web)
export async function signInWithGoogle(): Promise<TokenSet> {
  // Op web: popup meteen openen (synchroon, vóór elke await) zodat iOS Safari
  // het niet blokkeert als "niet door gebruiker geïnitieerd".
  const popup = Platform.OS === 'web'
    ? window.open('', 'google-auth', 'width=520,height=640,left=200,top=100')
    : null

  const verifier  = await generateVerifier()
  const challenge = await generateChallenge(verifier)

  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    redirect_uri:          REDIRECT_URI,
    response_type:         'code',
    scope:                 SCOPES,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    access_type:           'offline',
    prompt:                'consent',
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`

  if (Platform.OS === 'web') {
    localStorage.setItem('runyo_oauth_verifier', verifier)
    const code = await openGooglePopup(authUrl, popup)
    localStorage.removeItem('runyo_oauth_verifier')
    return exchangeCode(code, verifier, REDIRECT_URI)
  }

  const result = await WebBrowser.openAuthSessionAsync(authUrl, DEEP_LINK)
  if (result.type !== 'success') throw new Error('Auth cancelled')
  const url  = new URL(result.url)
  const code = url.searchParams.get('code')
  if (!code) throw new Error('No code in redirect URL')
  return exchangeCode(code, verifier, REDIRECT_URI)
}

function openGooglePopup(authUrl: string, popup: Window | null): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!popup) { reject(new Error('Popup geblokkeerd door browser')); return }
    popup.location.href = authUrl

    function cleanup() {
      clearInterval(closedInterval)
      window.removeEventListener('message', onMessage)
      window.removeEventListener('storage', onStorage)
    }

    // Desktop: callback stuurt code via postMessage
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== 'OAUTH_CODE') return
      cleanup()
      if (event.data.error) reject(new Error(event.data.error))
      else resolve(event.data.code)
    }

    // iOS Safari: callback slaat code op in localStorage en redirect;
    // storage-event vuurt in het originele tabblad
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'runyo_oauth_code' || !event.newValue) return
      const code = event.newValue
      localStorage.removeItem('runyo_oauth_code')
      cleanup()
      resolve(code)
    }

    const closedInterval = setInterval(() => {
      try {
        if (popup.closed) { cleanup(); reject(new Error('Auth cancelled')) }
      } catch {
        // COOP blokkeert popup.closed — negeer, auth verloopt via storage-event
      }
    }, 500)

    window.addEventListener('message', onMessage)
    window.addEventListener('storage', onStorage)
  })
}

export async function exchangeCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenSet> {
  const res = await fetch(`${BACKEND}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  const data = await res.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  const tokenSet: TokenSet = {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiry:       Date.now() + data.expires_in * 1000,
    email:        await fetchEmail(data.access_token),
  }
  await storeTokenSet(tokenSet)
  return tokenSet
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  const res = await fetch(`${BACKEND}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  const data = await res.json() as { access_token: string; expires_in: number }

  const email   = (await SecureStore.getItemAsync(KEYS.email)) ?? ''
  const tokenSet: TokenSet = {
    accessToken:  data.access_token,
    refreshToken,
    expiry:       Date.now() + data.expires_in * 1000,
    email,
  }
  await storeTokenSet(tokenSet)
  return tokenSet
}

export async function getAccessToken(): Promise<string | null> {
  const [token, expiryStr, refresh] = await Promise.all([
    SecureStore.getItemAsync(KEYS.token),
    SecureStore.getItemAsync(KEYS.expiry),
    SecureStore.getItemAsync(KEYS.refresh),
  ])
  if (!token) return null
  const expiry = parseInt(expiryStr ?? '0', 10)
  if (Date.now() < expiry - 60_000) return token
  if (!refresh) return null
  const tokenSet = await refreshAccessToken(refresh)
  return tokenSet.accessToken
}

export async function loadStoredTokenSet(): Promise<TokenSet | null> {
  // Probeer Google-token eerst; dan email-token als fallback.
  const [token, expiryStr, refresh, email] = await Promise.all([
    SecureStore.getItemAsync(KEYS.token),
    SecureStore.getItemAsync(KEYS.expiry),
    SecureStore.getItemAsync(KEYS.refresh),
    SecureStore.getItemAsync(KEYS.email),
  ])
  if (token && email) {
    return { accessToken: token, refreshToken: refresh ?? null, expiry: parseInt(expiryStr ?? '0', 10), email, authMethod: 'google' }
  }

  const [eToken, eExpiryStr, eEmail] = await Promise.all([
    SecureStore.getItemAsync(EMAIL_KEYS.token),
    SecureStore.getItemAsync(EMAIL_KEYS.expiry),
    SecureStore.getItemAsync(EMAIL_KEYS.email),
  ])
  if (eToken && eEmail) {
    const expiry = parseInt(eExpiryStr ?? '0', 10)
    if (Date.now() < expiry) {
      return { accessToken: eToken, refreshToken: null, expiry, email: eEmail, authMethod: 'email' }
    }
  }

  return null
}

export async function signOut(): Promise<void> {
  await Promise.all([
    ...Object.values(KEYS).map(k => SecureStore.deleteItemAsync(k)),
    ...Object.values(EMAIL_KEYS).map(k => SecureStore.deleteItemAsync(k)),
  ])
}

async function storeTokenSet(tokenSet: TokenSet): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.token,   tokenSet.accessToken),
    SecureStore.setItemAsync(KEYS.expiry,  String(tokenSet.expiry)),
    SecureStore.setItemAsync(KEYS.refresh, tokenSet.refreshToken ?? ''),
    SecureStore.setItemAsync(KEYS.email,   tokenSet.email),
  ])
}

async function fetchEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json() as { email?: string }
  return data.email ?? ''
}

// ── Email/wachtwoord auth ──────────────────────────────────────────────────────

const EMAIL_KEYS = {
  token:  'eauth_token',
  expiry: 'eauth_expiry',
  email:  'eauth_email',
}

export type EmailAuthError = 'INVALID_CREDENTIALS' | 'EMAIL_IN_USE' | 'WEAK_PASSWORD' | 'NETWORK_ERROR'

export async function signUpWithEmail(email: string, password: string): Promise<TokenSet> {
  const res = await fetch(`${BACKEND}/auth/email-signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = await res.json() as { error?: string }
    if (res.status === 409) throw Object.assign(new Error(body.error ?? 'E-mailadres al in gebruik'), { code: 'EMAIL_IN_USE' as EmailAuthError })
    if (res.status === 422) throw Object.assign(new Error(body.error ?? 'Wachtwoord te zwak'), { code: 'WEAK_PASSWORD' as EmailAuthError })
    throw Object.assign(new Error(body.error ?? 'Aanmelden mislukt'), { code: 'NETWORK_ERROR' as EmailAuthError })
  }
  const data = await res.json() as { userId: string; token: string }
  return storeEmailTokenSet(email.toLowerCase(), data.token)
}

export async function signInWithEmail(email: string, password: string): Promise<TokenSet> {
  const res = await fetch(`${BACKEND}/auth/email-signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = await res.json() as { error?: string }
    if (res.status === 401) throw Object.assign(new Error(body.error ?? 'Ongeldig e-mailadres of wachtwoord'), { code: 'INVALID_CREDENTIALS' as EmailAuthError })
    throw Object.assign(new Error(body.error ?? 'Inloggen mislukt'), { code: 'NETWORK_ERROR' as EmailAuthError })
  }
  const data = await res.json() as { userId: string; token: string }
  return storeEmailTokenSet(email.toLowerCase(), data.token)
}

async function storeEmailTokenSet(email: string, token: string): Promise<TokenSet> {
  const expiry = Date.now() + 90 * 24 * 60 * 60 * 1000
  await Promise.all([
    SecureStore.setItemAsync(EMAIL_KEYS.token,  token),
    SecureStore.setItemAsync(EMAIL_KEYS.expiry, String(expiry)),
    SecureStore.setItemAsync(EMAIL_KEYS.email,  email),
  ])
  return { accessToken: token, refreshToken: null, expiry, email, authMethod: 'email' }
}
