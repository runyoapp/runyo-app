import { useQueries } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { listActivities } from '@/services/activities'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'

// Multi-schema: één query per zichtbaar schema (queryKey blijft
// ['activities','backend',id] zodat bestaande invalidate/setQueryData werken).
// De resultaten worden samengevoegd tot één deterministisch gesorteerde lijst
// en in de store gezet — de views filteren puur op datum.
export function useActivities() {
  const visibleSchemaIds = useDataStore(s => s.visibleSchemaIds)
  const setActivities    = useDataStore(s => s.setActivities)
  // Op tokenSet abonneren zodat een login een refetch triggert.
  const tokenSet         = useAuthStore(s => s.tokenSet)

  const results = useQueries({
    queries: visibleSchemaIds.map(id => ({
      queryKey: ['activities', 'backend', id],
      queryFn:  () => listActivities(id),
      enabled:  !!tokenSet,
      staleTime: 1000 * 60 * 5,
    })),
  })

  // Hersleutel op de data-updates van alle queries zodat de merge alleen
  // herberekent wanneer er echt nieuwe data is (voorkomt referentie-churn).
  const updatedKey = results.map(r => r.dataUpdatedAt).join(',')
  const idsKey = visibleSchemaIds.join(',')
  const merged = useMemo(() => {
    const all = results.flatMap(r => r.data ?? [])
    return all.sort((a, b) => a.datum.localeCompare(b.datum) || a.schemaId.localeCompare(b.schemaId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedKey, idsKey])

  useEffect(() => {
    setActivities(merged)
  }, [merged, setActivities])

  const isLoading = results.length > 0 && results.some(r => r.isLoading)
  const isError = results.some(r => r.isError)
  return { isLoading, isError, results }
}
