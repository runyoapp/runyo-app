import type { UserSettings, Notifications } from '@/types/settings'

const BACKEND = 'https://runyo-auth-production.up.railway.app'

export async function saveUserSettings(
  token: string,
  telegramUser: string,
  notifications: Notifications,
): Promise<void> {
  const res = await fetch(`${BACKEND}/user/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ telegramUser, notifications }),
  })
  if (!res.ok) throw new Error(`Save settings failed: ${res.status}`)
}

export async function registerTelegram(
  botSecret: string,
  telegramUser: string,
  chatId: number,
): Promise<void> {
  const res = await fetch(`${BACKEND}/bot/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${botSecret}`,
    },
    body: JSON.stringify({ telegramUser, chatId }),
  })
  if (!res.ok) throw new Error(`Bot register failed: ${res.status}`)
}
