import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchActivities } from '@/services/sheets'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'

export function useActivities() {
  const getToken    = useAuthStore(s => s.getToken)
  const sheetId     = useDataStore(s => s.sheetId)
  const tabName     = useDataStore(s => s.tabName)
  const setActivities = useDataStore(s => s.setActivities)

  const query = useQuery({
    queryKey: ['activities', sheetId, tabName],
    queryFn: async () => {
      const token = await getToken()
      if (!token || !sheetId) return []
      return fetchActivities(sheetId, tabName, token)
    },
    enabled: !!sheetId,
    staleTime: 1000 * 60 * 5,
  })

  useEffect(() => {
    if (query.data) setActivities(query.data)
  }, [query.data])

  return query
}
