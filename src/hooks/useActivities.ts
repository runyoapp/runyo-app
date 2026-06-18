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
  const setActivitiesLoading = useDataStore(s => s.setActivitiesLoading)
  const backfillSpans    = useDataStore(s => s.backfillSpans)
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
  // Deps bewust op de afgeleide sleutels (updatedKey/idsKey), niet op `results`
  // zelf — zo herberekent de merge alleen bij echte data-updates.
  const merged = useMemo(() => {
    const all = results.flatMap(r => r.data ?? [])
    return all.sort((a, b) => a.datum.localeCompare(b.datum) || a.schemaId.localeCompare(b.schemaId))
  }, [updatedKey, idsKey])

  useEffect(() => {
    setActivities(merged)
    // Backfill vaste spans voor legacy-schema's zodra hun activiteiten geladen zijn.
    if (merged.length) backfillSpans()
  }, [merged, setActivities, backfillSpans])

  const isLoading = results.length > 0 && results.some(r => r.isLoading)
  const isError = results.some(r => r.isError)

  // Spiegel de laadstatus naar de store zodat schermen 'm kunnen lezen zonder
  // deze hook zelf aan te roepen (A3 — hook draait enkel in MainNavigator).
  useEffect(() => {
    setActivitiesLoading(isLoading)
  }, [isLoading, setActivitiesLoading])

  return { isLoading, isError, results }
}
