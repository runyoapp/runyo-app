import { useQueryClient } from '@tanstack/react-query'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { deleteActivity } from '@/services/activities'
import type { Activity } from '@/types/activity'

const UNDO_MS = 5000

// Verwijderen met "Ongedaan maken": de activiteit gaat meteen uit beeld, maar
// de backend-delete wordt UNDO_MS uitgesteld. Tikt de gebruiker binnen die tijd
// op "Ongedaan maken", dan zetten we 'm terug en is er nooit iets verwijderd —
// dus geen losse "weet je het zeker?"-dialoog nodig.
export function useDeleteActivityWithUndo() {
  const schemaId       = useDataStore(s => s.schemaId)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const removeActivity = useDataStore(s => s.removeActivity)
  const showToast      = useUiStore(s => s.showToast)
  const queryClient    = useQueryClient()

  return function deleteWithUndo(activity: Activity) {
    if (!schemaId) return
    removeActivity(activity.id)

    let undone = false
    const timer = setTimeout(async () => {
      if (undone) return
      try {
        await deleteActivity(schemaId, activity.id)
        await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      } catch {
        upsertActivity(activity)
        showToast('Verwijderen mislukt, probeer opnieuw.')
      }
    }, UNDO_MS)

    showToast('Verwijderd', UNDO_MS, {
      label: 'Ongedaan maken',
      onPress: () => {
        undone = true
        clearTimeout(timer)
        upsertActivity(activity)
      },
    })
  }
}
