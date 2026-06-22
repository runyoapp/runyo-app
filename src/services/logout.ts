import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { goToToday } from '@/navigation/navigationRef'

// Eén plek voor uitloggen: tokens weg, schema-/activiteit-state weg, instellingen
// terug naar defaults (incl. telegram + onboarding). Voorkomt dat op een gedeeld
// device data of voorkeuren van de vorige gebruiker lekken. Daarna terug naar de
// Vandaag-tab (en eventueel open Settings-modal dicht) i.p.v. blijven hangen op
// de tab waar je toevallig stond.
export async function logout(): Promise<void> {
  await useAuthStore.getState().signOut()
  await useDataStore.getState().clearAll()
  await useSettingsStore.getState().resetSettings()
  goToToday()
}
