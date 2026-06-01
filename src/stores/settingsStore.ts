import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AppPrefs, Notifications } from '@/types/settings'
import { DEFAULT_NOTIFICATIONS, DEFAULT_PREFS } from '@/types/settings'

const STORAGE_KEY = 'runyo_prefs'

type SettingsStore = {
  prefs: AppPrefs
  telegramUser: string
  notifications: Notifications
  onboardingDone: boolean
  hydrate: () => Promise<void>
  setPrefs: (prefs: Partial<AppPrefs>) => Promise<void>
  setTelegramUser: (user: string) => Promise<void>
  setNotifications: (notifications: Notifications) => Promise<void>
  setOnboardingDone: () => Promise<void>
}

type PersistedState = {
  prefs: AppPrefs
  telegramUser: string
  notifications: Notifications
  onboardingDone: boolean
}

async function persist(state: PersistedState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  prefs: DEFAULT_PREFS,
  telegramUser: '',
  notifications: DEFAULT_NOTIFICATIONS,
  onboardingDone: false,

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as Partial<PersistedState>
    const prefs = { ...DEFAULT_PREFS, ...saved.prefs }
    // B18: zonder gekozen locatie terugvallen op Utrecht (default), zodat ook
    // bestaande gebruikers met opgeslagen null-coördinaten het weer zien.
    if (prefs.weatherLat == null || prefs.weatherLon == null) {
      prefs.weatherLat  = DEFAULT_PREFS.weatherLat
      prefs.weatherLon  = DEFAULT_PREFS.weatherLon
      prefs.weatherCity = prefs.weatherCity ?? DEFAULT_PREFS.weatherCity
    }
    set({
      prefs,
      telegramUser:   saved.telegramUser ?? '',
      notifications:  { ...DEFAULT_NOTIFICATIONS, ...saved.notifications },
      onboardingDone: saved.onboardingDone ?? false,
    })
  },

  setPrefs: async (partial) => {
    const prefs = { ...get().prefs, ...partial }
    set({ prefs })
    await persist({ prefs, telegramUser: get().telegramUser, notifications: get().notifications, onboardingDone: get().onboardingDone })
  },

  setTelegramUser: async (telegramUser) => {
    set({ telegramUser })
    await persist({ prefs: get().prefs, telegramUser, notifications: get().notifications, onboardingDone: get().onboardingDone })
  },

  setNotifications: async (notifications) => {
    set({ notifications })
    await persist({ prefs: get().prefs, telegramUser: get().telegramUser, notifications, onboardingDone: get().onboardingDone })
  },

  setOnboardingDone: async () => {
    set({ onboardingDone: true })
    await persist({ prefs: get().prefs, telegramUser: get().telegramUser, notifications: get().notifications, onboardingDone: true })
  },
}))
