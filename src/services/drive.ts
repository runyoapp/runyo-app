function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export async function createExportSheet(token: string, schemaName: string): Promise<{ id: string; url: string }> {
  const title = `runyo — ${schemaName}`
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: 'Schema' } }],
    }),
  })
  if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  const data = await res.json() as { spreadsheetId: string }
  return { id: data.spreadsheetId, url: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}` }
}

export function todaySchemaName(): string {
  const d = new Date()
  const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  return `runyo schema ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
