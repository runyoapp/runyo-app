export type TokenSet = {
  accessToken: string
  refreshToken: string | null
  expiry: number       // Unix ms timestamp
  email: string
  authMethod?: 'google' | 'email' | 'apple'
}

export type AuthState =
  | { status: 'unauthenticated' }
  | { status: 'loading' }
  | { status: 'authenticated'; tokenSet: TokenSet }

export type GoogleUserInfo = {
  email: string
  name: string | null
  picture: string | null
}

export type SchemaEntry = {
  id: string           // Google Sheet ID
  name: string         // File name in Drive
  url: string | null   // Apps Script URL (legacy, optional)
  ts: number           // Last linked timestamp
}
