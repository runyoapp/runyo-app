import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { listActivities } from '@/services/activities'
import { useDataStore } from '@/stores/dataStore'

export function useActivities() {
  const schemaId      = useDataStore(s => s.schemaId)
  const setActivities = useDataStore(s => s.setActivities)

  const query = useQuery({
    queryKey: ['activities', 'backend', schemaId],
    queryFn:  () => listActivities(schemaId as string),
    enabled:  !!schemaId,
    staleTime: 1000 * 60 * 5,
  })

  const data = query.data
  useEffect(() => {
    if (data) setActivities(data)
  }, [data, setActivities])

  return query
}
