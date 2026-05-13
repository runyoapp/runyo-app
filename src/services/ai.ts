const BACKEND = 'https://runyo-auth-production.up.railway.app'

export type ImportResult = {
  rows: {
    datum: string
    type: string
    titel: string
    detail: string
    km: number | null
    fase: string | null
  }[]
}

export async function runAiImport(prompt: string): Promise<ImportResult> {
  const res = await fetch(`${BACKEND}/ai/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`AI import failed: ${res.status}`)
  const data = await res.json() as { content: { text: string }[] }
  const text = data.content[0]?.text ?? '[]'

  const jsonMatch = text.match(/```json\n?([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/)
  const parsed = JSON.parse(jsonMatch?.[1] ?? text) as ImportResult['rows']
  return { rows: parsed }
}

export async function logDebug(entry: Record<string, unknown>): Promise<void> {
  await fetch(`${BACKEND}/ai/debug-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...entry, ts: new Date().toISOString() }),
  }).catch(() => {})  // fire-and-forget, never throws
}
