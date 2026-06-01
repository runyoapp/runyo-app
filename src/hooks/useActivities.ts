import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { listActivities } from '@/services/activities'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'

export function useActivities() {
  const schemaId      = useDataStore(s => s.schemaId)
  const setActivities = useDataStore(s => s.setActivities)
  // Op tokenSet abonneren zodat een login een refetch triggert. Anders: als
  // schemaId al gezet is (gehydrateerd) maar er nog geen token is, faalt de
  // fetch stil en refetcht de query niet meer na inloggen (tot een refresh).
  const tokenSet      = useAuthStore(s => s.tokenSet)

  const query = useQuery({
    queryKey: ['activities', 'backend', schemaId],
    queryFn:  () => listActivities(schemaId as string),
    enabled:  !!schemaId && !!tokenSet,
    staleTime: 1000 * 60 * 5,
  })

  const data = query.data
  useEffect(() => {
    if (data) setActivities(data)
  }, [data, setActivities])

  return query
}
