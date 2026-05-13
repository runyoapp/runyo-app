import { useState, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { DayDetailModal } from '@/screens/DayDetailModal'
import { AddActivityModal } from '@/screens/AddActivityModal'
import { AppHeader } from '@/components/shared/AppHeader'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDataStore } from '@/stores/dataStore'
import { useActivities } from '@/hooks/useActivities'
import { SchemaHeader } from '@/components/plan/SchemaHeader'
import { PhaseBlock } from '@/components/plan/PhaseBlock'
import { LightTheme, Fonts, Spacing } from '@/constants/theme'
import type { Activity } from '@/types/activity'

export function PlanScreen() {
  const insets     = useSafeAreaInsets()
  const activities = useDataStore(s => s.activities)
  const sheetId    = useDataStore(s => s.sheetId)
  useActivities()

  const today = new Date().toISOString().split('T')[0]

  // Extract unique phases in order
  const phases = useMemo(() => {
    const seen  = new Set<string>()
    const order: string[] = []
    activities.forEach(a => {
      if (a.fase && !seen.has(a.fase)) { seen.add(a.fase); order.push(a.fase) }
    })
    return order
  }, [activities])

  // Auto-open current phase on first render
  const defaultOpen = useMemo(() => {
    if (!phases.length) return null
    const current = phases.find(f => {
      const rows  = activities.filter(a => a.fase === f)
      const start = rows[0]?.datum
      const end   = rows[rows.length - 1]?.datum
      return start && end && start <= today && end >= today
    })
    return current ?? phases[phases.length - 1]
  }, [phases])

  const [openFase,          setOpenFase]          = useState<string | null>(defaultOpen)
  const [selectedActivity,  setSelectedActivity]  = useState<Activity | null>(null)
  const [addModalOpen,      setAddModalOpen]      = useState(false)

  function toggle(fase: string) {
    setOpenFase(prev => prev === fase ? null : fase)
  }

  // No schema / no data states
  if (!sheetId) {
    return (
      <View style={[styles.root, styles.empty, { paddingTop: insets.top }]}>
        <Text style={styles.emptyTitle}>Geen schema gekoppeld</Text>
        <Text style={styles.emptySub}>Koppel je schema via Instellingen.</Text>
      </View>
    )
  }

  if (!activities.length) {
    return (
      <View style={[styles.root, styles.empty, { paddingTop: insets.top }]}>
        <Text style={styles.emptyTitle}>Geen data</Text>
        <Text style={styles.emptySub}>Je schema is leeg of wordt geladen.</Text>
      </View>
    )
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader onAddPress={() => setAddModalOpen(true)} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SchemaHeader activities={activities} />

        <View style={styles.phases}>
          {phases.length > 0 ? (
            phases.map(fase => (
              <PhaseBlock
                key={fase}
                fase={fase}
                rows={activities.filter(a => a.fase === fase)}
                isOpen={openFase === fase}
                today={today}
                onToggle={() => toggle(fase)}
                onEdit={setSelectedActivity}
              />
            ))
          ) : (
            // No phases — render all rows flat
            <PhaseBlock
              fase="Training"
              rows={activities}
              isOpen={true}
              today={today}
              onToggle={() => {}}
              onEdit={setSelectedActivity}
            />
          )}
        </View>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      <DayDetailModal
        activity={selectedActivity}
        visible={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
      <AddActivityModal
        visible={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: LightTheme.bg },
  phases:     { paddingHorizontal: Spacing.lg },
  empty:      { alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: Fonts.displayBold, fontSize: 20, color: LightTheme.text, marginBottom: Spacing.sm },
  emptySub:   { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.muted },
})
