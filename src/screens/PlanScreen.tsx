import { useState, useMemo, useRef, useEffect } from 'react'
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
  const [showRest,          setShowRest]          = useState(false)
  const scrollRef      = useRef<ScrollView>(null)
  const todayRowRef    = useRef<View>(null)
  const hasScrolled    = useRef(false)
  const phasesLayoutY  = useRef(0)
  const phaseLayoutYs  = useRef(new Map<string, number>())

  // openFase wordt gezet op mount, maar activiteiten kunnen asynchroon laden.
  // Zodra defaultOpen beschikbaar komt en openFase nog null is, zet alsnog.
  useEffect(() => {
    if (defaultOpen && !openFase) setOpenFase(defaultOpen)
  }, [defaultOpen])

  // C66: rustdagen standaard verborgen
  const visibleActivities = useMemo(
    () => showRest ? activities : activities.filter(a => a.type !== 'rest'),
    [activities, showRest],
  )

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
        <>
          {/* C66: rustdagen-toggle chip */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, showRest && styles.filterChipActive]}
              onPress={() => setShowRest(v => !v)}
            >
              <Text style={[styles.filterChipText, showRest && styles.filterChipTextActive]}>
                Rustdagen
              </Text>
            </TouchableOpacity>
          </View>

          {/* U41: scroll naar huidig faseblok bij mount.
              onLayout op elke fase-wrapper geeft y t.o.v. phases-View.
              onLayout op phases-View geeft y t.o.v. ScrollView content.
              Som = absolute scroll-offset voor het actieve blok. */}
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              if (hasScrolled.current || !defaultOpen) return
              const phaseY = phaseLayoutYs.current.get(defaultOpen)
              if (phaseY === undefined) return
              hasScrolled.current = true
              const target = phasesLayoutY.current + phaseY - 80
              scrollRef.current?.scrollTo({ y: Math.max(0, target), animated: false })
            }}
          >
            <SchemaHeader activities={activities} />

            <View
              style={styles.phases}
              onLayout={e => { phasesLayoutY.current = e.nativeEvent.layout.y }}
            >
              {phases.length > 0 ? (
                phases.map(fase => (
                  <View
                    key={fase}
                    onLayout={e => { phaseLayoutYs.current.set(fase, e.nativeEvent.layout.y) }}
                  >
                    <PhaseBlock
                      fase={fase}
                      rows={visibleActivities.filter(a => a.fase === fase)}
                      isOpen={openFase === fase}
                      today={today}
                      onToggle={() => toggle(fase)}
                      onEdit={setSelectedActivity}
                      todayRowRef={todayRowRef}
                    />
                  </View>
                ))
              ) : (
                <PhaseBlock
                  fase="Training"
                  rows={visibleActivities}
                  isOpen={true}
                  today={today}
                  onToggle={() => {}}
                  onEdit={setSelectedActivity}
                  todayRowRef={todayRowRef}
                />
              )}
            </View>

            <View style={{ height: Spacing.xl }} />
          </ScrollView>
        </>
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
  root:              { flex: 1, backgroundColor: LightTheme.bg },
  phases:            { paddingHorizontal: Spacing.lg },
  empty:             { alignItems: 'center', justifyContent: 'center' },
  emptyTitle:        { fontFamily: Fonts.displayBold, fontSize: 20, color: LightTheme.text, marginBottom: Spacing.sm },
  emptySub:          { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.muted, marginBottom: Spacing.lg },
  emptyBtn:          { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: LightTheme.accent },
  emptyBtnText:      { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: '#fff' },
  filterRow:         { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: Spacing.sm },
  filterChip:        { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill, backgroundColor: LightTheme.surface, borderWidth: 1, borderColor: LightTheme.border },
  filterChipActive:  { backgroundColor: LightTheme.accent, borderColor: LightTheme.accent },
  filterChipText:    { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.muted },
  filterChipTextActive: { color: '#fff' },
})
