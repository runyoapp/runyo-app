import { useState, useMemo, useRef, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { AddActivityModal } from '@/screens/AddActivityModal'
import { DayDetailModal } from '@/screens/DayDetailModal'
import { ImportWizard } from '@/screens/import/ImportWizard'
import { ImportSchemaTile } from '@/components/shared/ImportSchemaTile'
import { AppHeader } from '@/components/shared/AppHeader'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDataStore, type SchemaMeta } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { SchemaHeader } from '@/components/plan/SchemaHeader'
import { SchemaSwitcher } from '@/components/plan/SchemaSwitcher'
import { PlanWeek, type PlanWeekData } from '@/components/plan/PlanWeek'
import { WeekbouwerScreen } from '@/components/weekbouwer/WeekbouwerScreen'
import { EditorScreen } from '@/components/weekbouwer/EditorScreen'
import { Fonts, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { PageContainer } from '@/components/shared/PageContainer'
import { toDateString, fromDateString, addDays, MONTHS_NL } from '@/utils/date'
import { effectiveSpan } from '@/utils/schemaRouting'
import type { Activity } from '@/types/activity'

type PlanMode = 'plan' | 'week' | 'editor'

// Groepeer activiteiten in maandag-zondag weken over de vaste plan-span (zie
// effectiveSpan: maandag-start + weekduur, met de opgeslagen weekCount als ondergrens).
// Werk-items én rustdagen tellen niet mee in plan (privé-agenda / geen training).
// De start ligt vast: een race in het verleden verschuift week 1 niet; een latere
// activiteit rekt het raster wél op (cover-weken in effectiveSpan).
function buildWeeks(activities: PlanWeekData['days'], today: string, schema: SchemaMeta | null): PlanWeekData[] {
  if (!schema) return []
  // Plan toont één doorlopende tijdlijn voor het primaire schema. Bij meerdere
  // zichtbare schema's mogen de activiteiten van andere schema's niet in dít
  // week-raster belanden (anders kloppen span, "week X van Y", km en voortgang
  // niet) — dus eerst op het eigen schema filteren.
  const own = activities.filter(a => a.schemaId === schema.id)
  const real = own.filter(a => a.datum && a.type !== 'work' && a.type !== 'rest')
  if (!real.length) return []
  const span      = effectiveSpan(own, schema)
  const sorted    = [...real].sort((a, b) => a.datum.localeCompare(b.datum))
  const firstMon  = fromDateString(span.start)

  const weeks: PlanWeekData[] = []
  let cursor = firstMon
  let num    = 1
  while (num <= span.weeks) {
    const mon = toDateString(cursor)
    const sun = toDateString(addDays(cursor, 6))
    const d0  = cursor
    const d6  = addDays(cursor, 6)
    const m0  = MONTHS_NL[d0.getMonth()]
    const m6  = MONTHS_NL[d6.getMonth()]
    const range = m0 === m6
      ? `${d0.getDate()} - ${d6.getDate()} ${m6}`
      : `${d0.getDate()} ${m0} - ${d6.getDate()} ${m6}`

    const days   = sorted.filter(a => a.datum >= mon && a.datum <= sun)
    const goalKm = Math.round(days.reduce((s, a) => s + (a.km ?? 0), 0))
    const doneKm = Math.round(
      days.filter(a => a.datum <= today).reduce((s, a) => s + (a.km ?? 0), 0),
    )
    const status: PlanWeekData['status'] =
      sun < today ? 'done' : (mon <= today ? 'current' : 'next')

    weeks.push({
      num, monday: mon, range, goalKm, doneKm, status,
      hasRace: days.some(a => a.type === 'race'),
      days,
    })
    cursor = addDays(cursor, 7)
    num++
  }
  return weeks
}

export function PlanScreen() {
  const insets     = useSafeAreaInsets()
  const activities = useDataStore(s => s.activities)
  const schemaId   = useDataStore(s => s.schemaId)
  const schemaList = useDataStore(s => s.schemaList)
  const visibleSchemaIds = useDataStore(s => s.visibleSchemaIds)
  const theme      = useTheme()

  // Welk zichtbaar schema toont de tijdlijn. null = volg de globale primary;
  // de switcher zet 'm expliciet. Valt terug op primary als de keuze niet meer
  // zichtbaar is (bv. schema verborgen via instellingen).
  const [viewSchemaId, setViewSchemaId] = useState<string | null>(null)
  const activeSchemaId =
    viewSchemaId && visibleSchemaIds.includes(viewSchemaId) ? viewSchemaId : schemaId

  const visibleSchemas = useMemo(
    () => visibleSchemaIds
      .map(id => schemaList.find(s => s.id === id))
      .filter((s): s is SchemaMeta => !!s),
    [visibleSchemaIds, schemaList],
  )

  const schema = useMemo(
    () => schemaList.find(s => s.id === activeSchemaId) ?? null,
    [schemaList, activeSchemaId],
  )

  const today = useMemo(() => toDateString(new Date()), [])

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [importOpen,   setImportOpen]   = useState(false)
  const [detailActivity, setDetailActivity] = useState<Activity | null>(null)

  // Weekbouwer-navigatie: lokale screen-state (geen RootNavigator-wijziging).
  const [mode,            setMode]            = useState<PlanMode>('plan')
  const [activeWeekMonday, setActiveWeekMonday] = useState<string | null>(null)
  const [editActivity,    setEditActivity]    = useState<Activity | null>(null)

  // Verberg de tab-balk zolang de weekbouwer/editor (full-screen) open is.
  const setTabBarHidden = useUiStore(s => s.setTabBarHidden)
  useEffect(() => {
    setTabBarHidden(mode !== 'plan')
    return () => setTabBarHidden(false)
  }, [mode, setTabBarHidden])

  const weeks = useMemo(() => buildWeeks(activities, today, schema), [activities, today, schema])
  // SchemaHeader (titel via volgende race, start/eind) volgt dezelfde primaire-schema
  // tijdlijn als de week-lijst eronder.
  const schemaActivities = useMemo(
    () => activities.filter(a => a.schemaId === activeSchemaId),
    [activities, activeSchemaId],
  )
  const maxGoalKm = useMemo(() => weeks.reduce((m, w) => Math.max(m, w.goalKm), 0), [weeks])

  // Huidige week staat default open.
  const currentNum = useMemo(
    () => weeks.find(w => w.status === 'current')?.num ?? null,
    [weeks],
  )
  const [openSet, setOpenSet] = useState<Set<number>>(new Set())
  // Open de huidige week zodra die bekend is (alleen initieel, niet bij elke render).
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current || currentNum === null) return
    seededRef.current = true
    setOpenSet(new Set([currentNum]))
  }, [currentNum])

  const toggle = (num: number) =>
    setOpenSet(prev => {
      const next = new Set(prev)
      next.has(num) ? next.delete(num) : next.add(num)
      return next
    })

  // Auto-scroll naar de huidige week.
  const scrollRef   = useRef<ScrollView>(null)
  const hasScrolled = useRef(false)
  const [targetY, setTargetY]           = useState<number | null>(null)
  const [contentReady, setContentReady] = useState(false)
  useEffect(() => {
    if (hasScrolled.current || targetY === null || !contentReady) return
    hasScrolled.current = true
    scrollRef.current?.scrollTo({ y: Math.max(0, targetY - 12), animated: false })
  }, [targetY, contentReady])

  // Bij schemawisseling: opnieuw de huidige week openen + naar boven scrollen
  // (de week-lijst en huidige week verschillen per schema).
  useEffect(() => {
    seededRef.current   = false
    hasScrolled.current = false
    setOpenSet(new Set())
    setTargetY(null)
    setContentReady(false)
  }, [activeSchemaId])

  const noSchema = !schemaId
  const noData   = !noSchema && !weeks.length

  // Weekbouwer (week-overzicht van één week, dagen live uit de store).
  if (mode === 'week' && activeWeekMonday) {
    return (
      <WeekbouwerScreen
        weekMonday={activeWeekMonday}
        weeks={weeks}
        onBack={() => setMode('plan')}
        onEditActivity={(a) => { setEditActivity(a); setMode('editor') }}
        onJumpToWeek={(monday) => setActiveWeekMonday(monday)}
      />
    )
  }

  // Editor (één activiteit bewerken).
  if (mode === 'editor' && editActivity) {
    return (
      <EditorScreen
        activity={editActivity}
        onBack={() => { setEditActivity(null); setMode('week') }}
      />
    )
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <PageContainer>
        <AppHeader onAddPress={() => setAddModalOpen(true)} />

        {!noSchema && visibleSchemas.length >= 2 && (
          <SchemaSwitcher
            schemas={visibleSchemas}
            activeId={activeSchemaId}
            onSelect={setViewSchemaId}
          />
        )}

        {noSchema && (
          <View style={styles.emptyNoSchema}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Geen schema gekoppeld</Text>
            <Text style={[styles.emptySub, { color: theme.muted }]}>
              Koppel jouw trainingsschema en zie hier je volledige planning, week voor week.
            </Text>
            <ImportSchemaTile onPress={() => setImportOpen(true)} />
          </View>
        )}

        {noData && (
          <View style={[styles.empty, { flex: 1 }]}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Geen data</Text>
            <Text style={[styles.emptySub, { color: theme.muted }]}>Je schema is leeg of wordt geladen.</Text>
          </View>
        )}

        {!noSchema && !noData && (
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => setContentReady(true)}
            contentContainerStyle={styles.scrollContent}
          >
            <SchemaHeader weeks={weeks} activities={schemaActivities} />
            {weeks.map(w => (
              <View
                key={w.num}
                style={styles.weekWrap}
                onLayout={w.num === currentNum
                  ? e => setTargetY(e.nativeEvent.layout.y)
                  : undefined}
              >
                <PlanWeek
                  week={w}
                  today={today}
                  maxGoalKm={maxGoalKm}
                  expanded={openSet.has(w.num)}
                  onToggle={() => toggle(w.num)}
                  onActivityPress={setDetailActivity}
                  onEditWeek={() => { setActiveWeekMonday(w.monday); setMode('week') }}
                />
              </View>
            ))}
            {/* Ruimte zodat de onderste week niet achter de zwevende tab-balk valt */}
            <View style={{ height: insets.bottom + 96 }} />
          </ScrollView>
        )}
      </PageContainer>

      <AddActivityModal
        visible={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
      <ImportWizard
        visible={importOpen}
        onClose={() => setImportOpen(false)}
      />
      <DayDetailModal
        activity={detailActivity}
        visible={detailActivity !== null}
        onClose={() => setDetailActivity(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  scrollContent: { paddingTop: Spacing.xs },
  weekWrap:      { paddingHorizontal: Spacing.lg },
  empty:         { alignItems: 'center', justifyContent: 'center' },
  emptyNoSchema: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, gap: Spacing.xs },
  emptyTitle:    { fontFamily: Fonts.displayBold, fontSize: 20, marginBottom: Spacing.sm },
  emptySub:      { fontFamily: Fonts.display, fontSize: 14, marginBottom: Spacing.lg },
})
