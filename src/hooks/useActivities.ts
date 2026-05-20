import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchActivities } from '@/services/sheets'
import { listActivities } from '@/services/activities'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'

// runyo v4 — when a backend schemaId is set, fetch from /api/schemas/:id/activities;
// otherwise fall through to the legacy Sheets path. The two are mutually exclusive
// per dataStore.activities — schemaId wins as soon as it is present (ticket 2.1d).

export function useActivities() {
  const getToken     = useAuthStore(s => s.getToken)
  const sheetId      = useDataStore(s => s.sheetId)
  const tabName      = useDataStore(s => s.tabName)
  const schemaId     = useDataStore(s => s.schemaId)
  const setActivities = useDataStore(s => s.setActivities)

  const useBackend = !!schemaId

  const query = useQuery({
    queryKey: useBackend
      ? ['activities', 'backend', schemaId]
      : ['activities', 'sheets', sheetId, tabName],
    queryFn: async () => {
      if (useBackend) {
        return listActivities(schemaId as string)
      }
      const token = await getToken()
      if (!token || !sheetId) return []
      return fetchActivities(sheetId, tabName, token)
    },
    enabled: useBackend || !!sheetId,
    staleTime: 1000 * 60 * 5,
  })

  const data = query.data
  useEffect(() => {
    if (data) setActivities(data)
  }, [data, setActivities])

  return query
}
