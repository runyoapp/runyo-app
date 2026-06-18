import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useSettingsStore } from '@/stores/settingsStore'

// Eén plek voor uitloggen: tokens weg, schema-/activiteit-state weg, instellingen
// terug naar defaults (incl. telegram + onboarding). Voorkomt dat op een gedeeld
// device data of voorkeuren van de vorige gebruiker lekken.
export async function logout(): Promise<void> {
  await useAuthStore.getState().signOut()
  await useDataStore.getState().clearAll()
  await useSettingsStore.getState().resetSettings()
}
