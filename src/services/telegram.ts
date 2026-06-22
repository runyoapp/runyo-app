// runyo v4 — Telegram deep-link koppeling (activatie-funnel).
// De app vraagt een koppel-token op, opent t.me/runyo_appbot?start=<token> en
// pollt op de status tot de bot de chat heeft gekoppeld.

const BACKEND = 'https://runyo-auth-production.up.railway.app'

export type TelegramLink = {
  token: string
  url: string
  botUsername: string
  expiresInSec: number
}

export type TelegramStatus = {
  linked: boolean
  username: string | null
}

// POST /api/telegram/link — eenmalig koppel-token + deep-link.
export async function createTelegramLink(token: string): Promise<TelegramLink> {
  const res = await fetch(`${BACKEND}/api/telegram/link`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`telegram link failed: ${res.status}`)
  return res.json()
}

// GET /api/telegram/status — gekoppeld? (de wizard pollt hierop).
export async function getTelegramStatus(token: string): Promise<TelegramStatus> {
  const res = await fetch(`${BACKEND}/api/telegram/status`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`telegram status failed: ${res.status}`)
  return res.json()
}

// POST /api/telegram/unlink — stopt het dagelijkse bericht.
export async function unlinkTelegram(token: string): Promise<void> {
  const res = await fetch(`${BACKEND}/api/telegram/unlink`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`telegram unlink failed: ${res.status}`)
}

// POST /api/telegram/test — stuur nu een testbericht via de bot.
export async function sendTelegramTest(token: string): Promise<boolean> {
  const res = await fetch(`${BACKEND}/api/telegram/test`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  })
  return res.ok
}
