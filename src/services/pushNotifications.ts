import * as Notifications from 'expo-notifications'
import { Linking } from 'react-native'

const BACKEND = 'https://runyo-auth-production.up.railway.app'

export type PushRegistrationResult =
  | { granted: false }
  | { granted: true; expoToken: string }

export async function registerForPushNotifications(
  getToken: () => Promise<string | null>,
): Promise<PushRegistrationResult> {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return { granted: false }

  const tokenData = await Notifications.getExpoPushTokenAsync()
  const expoToken = tokenData.data
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const token = await getToken()
  if (!token) return { granted: true, expoToken }

  await fetch(`${BACKEND}/api/push-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ expoToken, timezone }),
  }).catch(() => {})

  return { granted: true, expoToken }
}

export async function unregisterPushToken(
  expoToken: string,
  getToken: () => Promise<string | null>,
): Promise<void> {
  const token = await getToken()
  if (!token) return
  await fetch(`${BACKEND}/api/push-tokens`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ expoToken }),
  }).catch(() => {})
}

export async function loadPushPrefs(getToken: () => Promise<string | null>) {
  const token = await getToken()
  if (!token) return null
  const res = await fetch(`${BACKEND}/api/notification-prefs`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json() as Promise<{
    vandaagEnabled: boolean
    vandaagTime: string
    morgenEnabled: boolean
    morgenTime: string
  }>
}

export async function savePushPrefs(
  getToken: () => Promise<string | null>,
  prefs: { vandaagEnabled: boolean; vandaagTime: string; morgenEnabled: boolean; morgenTime: string },
): Promise<void> {
  const token = await getToken()
  if (!token) throw new Error('Niet ingelogd')
  const res = await fetch(`${BACKEND}/api/notification-prefs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(prefs),
  })
  if (!res.ok) throw new Error(`Opslaan mislukt: ${res.status}`)
}

export async function openNotificationSettings(): Promise<void> {
  await Linking.openSettings()
}
