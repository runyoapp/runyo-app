import { useState, useMemo, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { DayDetailModal } from '@/screens/DayDetailModal'
import { AddActivityModal } from '@/screens/AddActivityModal'
import { ImportModal } from '@/screens/ImportModal'
import { AppHeader } from '@/components/shared/AppHeader'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDataStore } from '@/stores/dataStore'
import { useActivities } from '@/hooks/useActivities'
import { SchemaHeader } from '@/components/plan/SchemaHeader'
import { PhaseBlock } from '@/components/plan/PhaseBlock'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { PageContainer } from '@/components/shared/PageContainer'
import type { Activity } from '@/types/activity'

export function PlanScreen() {
  const insets     = useSafeAreaInsets()
  const activities = useDataStore(s => s.activities)
  const sheetId    = useDataStore(s => s.sheetId)
  const schemaId   = useDataStore(s => s.schemaId)
  const theme      = useTheme()
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
  const [importOpen,        setImportOpen]        = useState(false)
  const scrollRef     = useRef<ScrollView>(null)
  const todayRowY     = useRef<number>(0)
  const hasScrolled   = useRef(false)

  function toggle(fase: string) {
    setOpenFase(prev => prev === fase ? null : fase)
  }

  // U39: header altijd renderen — empty-state onder de header
  const noSchema = !sheetId && !schemaId
  const noData   = !noSchema && !activities.length

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <PageContainer>
      <AppHeader onAddPress={() => setAddModalOpen(true)} />

      {noSchema && (
        <View style={[styles.empty, { flex: 1 }]}>
          <Text style={styles.emptyTitle}>Geen schema gekoppeld</Text>
          <Text style={styles.emptySub}>Importeer je trainingsplan om te beginnen.</Text>
          <TouchableOpacity onPress={() => setImportOpen(true)} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Schema koppelen →</Text>
          </TouchableOpacity>
        </View>
      )}

      {noData && (
        <View style={[styles.empty, { flex: 1 }]}>
          <Text style={styles.emptyTitle}>Geen data</Text>
          <Text style={styles.emptySub}>Je schema is leeg of wordt geladen.</Text>
        </View>
      )}

      {!noSchema && !noData && (
      {/* U41: scroll naar eerstvolgende training bij mount */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (hasScrolled.current) return
          if (todayRowY.current > 0) {
            hasScrolled.current = true
            scrollRef.current?.scrollTo({ y: Math.max(0, todayRowY.current - 80), animated: false })
          }
        }}
      >
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
                onTodayLayout={(y: number) => { todayRowY.current = y }}
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
      )}
      </PageContainer>

      <DayDetailModal
        activity={selectedActivity}
        visible={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
      <AddActivityModal
        visible={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
      <ImportModal
        visible={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: LightTheme.bg },
  phases:     { paddingHorizontal: Spacing.lg },
  empty:      { alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: Fonts.displayBold, fontSize: 20, color: LightTheme.text, marginBottom: Spacing.sm },
  emptySub:   { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.muted, marginBottom: Spacing.lg },
  emptyBtn:   { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: LightTheme.accent },
  emptyBtnText: { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: '#fff' },
})
