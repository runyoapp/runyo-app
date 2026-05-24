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
import { PlanRow } from '@/components/plan/PlanRow'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { PageContainer } from '@/components/shared/PageContainer'
import { toDateString } from '@/utils/date'
import type { Activity } from '@/types/activity'

export function PlanScreen() {
  const insets     = useSafeAreaInsets()
  const activities = useDataStore(s => s.activities)
  const sheetId    = useDataStore(s => s.sheetId)
  const schemaId   = useDataStore(s => s.schemaId)
  const theme      = useTheme()
  useActivities()

  // Gebruik lokale datum (zelfde als de rest van de app) i.p.v. toISOString (UTC).
  const today = useMemo(() => toDateString(new Date()), [])

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [addModalOpen,     setAddModalOpen]     = useState(false)
  const [importOpen,       setImportOpen]       = useState(false)
  const [showRest,         setShowRest]         = useState(false)
  const scrollRef      = useRef<ScrollView>(null)
  const hasScrolled    = useRef(false)

  // State (niet refs) zodat useEffect opnieuw vuurt zodra een waarde binnenkomt.
  const [targetY, setTargetY]           = useState<number | null>(null)
  const [contentReady, setContentReady] = useState(false)

  useEffect(() => {
    if (hasScrolled.current || targetY === null || !contentReady) return
    hasScrolled.current = true
    scrollRef.current?.scrollTo({ y: Math.max(0, targetY - 80), animated: false })
  }, [targetY, contentReady])

  // C66: rustdagen standaard verborgen
  const visibleActivities = useMemo(
    () => showRest ? activities : activities.filter(a => a.type !== 'rest'),
    [activities, showRest],
  )

  const byDate = useMemo(() => {
    const sorted = [...visibleActivities].sort((a, b) => a.datum.localeCompare(b.datum))
    const result: { datum: string; rows: Activity[] }[] = []
    sorted.forEach(a => {
      const last = result[result.length - 1]
      if (last && last.datum === a.datum) last.rows.push(a)
      else result.push({ datum: a.datum, rows: [a] })
    })
    return result
  }, [visibleActivities])

  // Eerste zichtbare datum >= vandaag. Pakt morgen als vandaag een (verborgen) rustdag is.
  const scrollTarget = useMemo(
    () => byDate.find(({ datum }) => datum >= today)?.datum ?? null,
    [byDate, today],
  )

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

            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => setContentReady(true)}
            >
              <SchemaHeader activities={activities} />
              {byDate.map(({ datum, rows }) => (
                <View
                  key={datum}
                  style={styles.dayRow}
                  onLayout={datum === scrollTarget
                    ? e => setTargetY(e.nativeEvent.layout.y)
                    : undefined}
                >
                  <PlanRow
                    datum={datum}
                    rows={rows}
                    isToday={datum === today}
                    isPast={datum < today}
                    onEdit={setSelectedActivity}
                  />
                </View>
              ))}
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
  root:                 { flex: 1, backgroundColor: LightTheme.bg },
  dayRow:               { paddingHorizontal: Spacing.lg },
  empty:                { alignItems: 'center', justifyContent: 'center' },
  emptyTitle:           { fontFamily: Fonts.displayBold, fontSize: 20, color: LightTheme.text, marginBottom: Spacing.sm },
  emptySub:             { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.muted, marginBottom: Spacing.lg },
  emptyBtn:             { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: LightTheme.accent },
  emptyBtnText:         { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: '#fff' },
  filterRow:            { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: Spacing.sm },
  filterChip:           { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill, backgroundColor: LightTheme.surface, borderWidth: 1, borderColor: LightTheme.border },
  filterChipActive:     { backgroundColor: LightTheme.accent, borderColor: LightTheme.accent },
  filterChipText:       { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.muted },
  filterChipTextActive: { color: '#fff' },
})
