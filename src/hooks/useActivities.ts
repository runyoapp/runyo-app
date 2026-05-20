import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchActivities } from '@/services/sheets'
import { listActivities } from '@/services/activities'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'

// runyo v4 — leader: if a Sheets schema is connected (sheetId), that drives the
// list — matches the v3 user mental model where the sheet IS the training data.
// Backend takes over only when no sheet is connected (new v4-native users).
// The Sheets→backend import flow that unifies them lives in a later ticket.

export function useActivities() {
  const getToken     = useAuthStore(s => s.getToken)
  const sheetId      = useDataStore(s => s.sheetId)
  const tabName      = useDataStore(s => s.tabName)
  const schemaId     = useDataStore(s => s.schemaId)
  const setActivities = useDataStore(s => s.setActivities)

  const useBackend = !!schemaId && !sheetId

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
