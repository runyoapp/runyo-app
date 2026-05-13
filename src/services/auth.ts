import * as AuthSession from 'expo-auth-session'
import * as SecureStore from 'expo-secure-store'
import type { TokenSet } from '@/types/auth'

const CLIENT_ID = '360342745908-n5l0071jgfb76nn0qtj65d9rcmolgbqf.apps.googleusercontent.com'
const BACKEND = 'https://runyo-auth-production.up.railway.app'

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
]

const KEYS = {
  token:   'gauth_token',
  expiry:  'gauth_expiry',
  refresh: 'gauth_refresh',
  email:   'gauth_email',
}

// expo-auth-session discovery for Google
const discovery = AuthSession.useAutoDiscovery
  ? undefined
  : {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
    }

export function useGoogleAuth() {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'runyo' })
  console.log('[auth] redirectUri:', redirectUri)

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: SCOPES,
      redirectUri,
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
    },
    {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    },
  )

  return { request, response, promptAsync, redirectUri }
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
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiry: Date.now() + data.expires_in * 1000,
    email: await fetchEmail(data.access_token),
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

  const email = (await SecureStore.getItemAsync(KEYS.email)) ?? ''
  const tokenSet: TokenSet = {
    accessToken: data.access_token,
    refreshToken,
    expiry: Date.now() + data.expires_in * 1000,
    email,
  }
  await storeTokenSet(tokenSet)
  return tokenSet
}

// Returns a valid access token — silently refreshes if within 60s of expiry
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
    accessToken: token,
    refreshToken: refresh ?? null,
    expiry: parseInt(expiryStr ?? '0', 10),
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
