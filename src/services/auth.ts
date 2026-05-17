import * as WebBrowser from 'expo-web-browser'
import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
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

// Main sign-in — opens SFSafariViewController, catches runyo://auth deep link
export async function signInWithGoogle(): Promise<TokenSet> {
  const verifier   = await generateVerifier()
  const challenge  = await generateChallenge(verifier)

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
  const result  = await WebBrowser.openAuthSessionAsync(authUrl, DEEP_LINK)

  if (result.type !== 'success') throw new Error('Auth cancelled')

  const url  = new URL(result.url)
  const code = url.searchParams.get('code')
  if (!code) throw new Error('No code in redirect URL')

  return exchangeCode(code, verifier, REDIRECT_URI)
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
  const [token, expiryStr, refresh, email] = await Promise.all([
    SecureStore.getItemAsync(KEYS.token),
    SecureStore.getItemAsync(KEYS.expiry),
    SecureStore.getItemAsync(KEYS.refresh),
    SecureStore.getItemAsync(KEYS.email),
  ])
  if (!token || !email) return null
  return {
    accessToken:  token,
    refreshToken: refresh ?? null,
    expiry:       parseInt(expiryStr ?? '0', 10),
    email,
  }
}

export async function signOut(): Promise<void> {
  await Promise.all(Object.values(KEYS).map(k => SecureStore.deleteItemAsync(k)))
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
