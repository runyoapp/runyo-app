export type NotifConfig = {
  enabled: boolean
  times: string[]      // "HH:MM" 24-hour strings, e.g. ["07:00", "20:00"]
}

export type Notifications = {
  schema: NotifConfig
  feedback: NotifConfig
}

export type UserSettings = {
  email: string
  telegramUser: string
  chatId: number | null
  notifications: Notifications
}

export type AppPrefs = {
  lang: 'nl' | 'en'
  theme: 'light' | 'dark'
  weatherLat: number | null
  weatherLon: number | null
  weatherCity: string | null
}

export const DEFAULT_NOTIFICATIONS: Notifications = {
  schema:   { enabled: true,  times: ['07:00'] },
  feedback: { enabled: true,  times: ['20:00'] },
}

// B18: standaard op Utrecht tenzij de gebruiker een andere locatie kiest in settings.
export const DEFAULT_PREFS: AppPrefs = {
  lang: 'nl',
  theme: 'light',
  weatherLat: 52.0907,
  weatherLon: 5.1214,
  weatherCity: 'Utrecht',
}
