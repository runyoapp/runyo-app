import { useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { useSwipeAnimation } from '@/hooks/useSwipeAnimation'
import { useDaySwipe } from '@/hooks/useDaySwipe'
import { createActivitiesBatch, type ActivityCreateInput } from '@/services/activities'
import { PageContainer } from '@/components/shared/PageContainer'
import { WeekDragStrip } from '@/components/shared/WeekDragStrip'
import { AddActivityModal } from '@/screens/AddActivityModal'
import { ActivityActionSheet } from '@/components/weekbouwer/ActivityActionSheet'
import { WeekBlocks } from '@/components/weekbouwer/WeekBlocks'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import { volumeCategory, categoryLabel, categoryColor } from '@/utils/runCategory'
import {
  MONTHS_NL, fromDateString, addDays, toDateString,
} from '@/utils/date'
import type { PlanWeekData } from '@/components/plan/PlanWeek'
import type { Activity } from '@/types/activity'

type Props = {
  weekMonday: string
  weeks: PlanWeekData[]      // alle weken (num/range/goalKm) voor identificatie + blokken
  onBack: () => void
  onEditActivity: (activity: Activity) => void
  onJumpToWeek: (monday: string) => void
}

type Clipboard = { sourceMonday: string; sourceNum: number; sessions: Activity[] }

function weekRange(monday: string): string {
  const d0 = fromDateString(monday)
  const d6 = addDays(d0, 6)
  const m0 = MONTHS_NL[d0.getMonth()]
  const m6 = MONTHS_NL[d6.getMonth()]
  return m0 === m6
    ? `${d0.getDate()} - ${d6.getDate()} ${m6}`
    : `${d0.getDate()} ${m0} - ${d6.getDate()} ${m6}`
}

// Velden die we kopiëren bij plakken (geen feedback/rating).
function copyInput(a: Activity, datum: string): ActivityCreateInput {
  return {
    datum,
    type: a.type,
    titel: a.titel || null,
    detail: a.detail || null,
    km: a.km,
    targetPace: a.targetPace,
    targetHr: a.targetHr,
    intervals: a.intervals,
  }
}

export function WeekbouwerScreen({ weekMonday, weeks, onBack, onEditActivity, onJumpToWeek }: Props) {
  const theme          = useTheme()
  const insets         = useSafeAreaInsets()
  const allActivities  = useDataStore(s => s.activities)
  const schemaId       = useDataStore(s => s.schemaId)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const showToast      = useUiStore(s => s.showToast)
  const queryClient    = useQueryClient()

  const [sheetActivity, setSheetActivity] = useState<Activity | null>(null)
  const [addOpen, setAddOpen]             = useState(false)
  const [clipboard, setClipboard]         = useState<Clipboard | null>(null)
  const [pasting, setPasting]             = useState(false)
  const [dragging, setDragging]           = useState(false)

  const today = useMemo(() => toDateString(new Date()), [])

  // Virtuele toekomst-weken: zolang je een week-kopie vasthebt kun je voorbij de
  // laatste schema-week swipen om een kopie buiten het schema te plakken. Er worden
  // staafjes voor gemaakt tot de week waar je nu bent; swipe je terug, dan verdwijnen
  // ze weer. Plak je er echt in, dan worden het op de volgende render gewone weken.
  const displayWeeks = useMemo(() => {
    if (!weeks.length) return weeks
    const last = weeks[weeks.length - 1]
    const diff = Math.round(
      (fromDateString(weekMonday).getTime() - fromDateString(last.monday).getTime()) / (7 * 86400000),
    )
    if (diff <= 0) return weeks
    const extra: PlanWeekData[] = Array.from({ length: diff }, (_, k) => {
      const mon   = toDateString(addDays(fromDateString(last.monday), 7 * (k + 1)))
      const dates = Array.from({ length: 7 }, (_, i) => toDateString(addDays(fromDateString(mon), i)))
      const days  = allActivities
        .filter(a => dates.includes(a.datum) && a.type !== 'work' && a.type !== 'rest')
        .sort((a, b) => a.datum.localeCompare(b.datum))
      return {
        num: last.num + k + 1, monday: mon, range: weekRange(mon),
        goalKm: Math.round(days.reduce((s, a) => s + (a.km ?? 0), 0)),
        doneKm: 0, status: 'next' as const,
        hasRace: days.some(a => a.type === 'race'), days,
      }
    })
    return [...weeks, ...extra]
  }, [weeks, weekMonday, allActivities])

  // Weekindex + zijwaartse navigatie tussen weken.
  const weekIdx  = useMemo(() => displayWeeks.findIndex(w => w.monday === weekMonday), [displayWeeks, weekMonday])
  const weekMeta = weekIdx >= 0 ? displayWeeks[weekIdx] : undefined
  const swipeAnim   = useSwipeAnimation(weekIdx)
  const goWeek = (dir: number) => {
    const target = displayWeeks[weekIdx + dir]
    if (target) { onJumpToWeek(target.monday); return }
    // Voorbij de laatste week: alleen vooruit, en alleen met een week-kopie vast.
    if (dir > 0 && clipboard) {
      onJumpToWeek(toDateString(addDays(fromDateString(weekMonday), 7)))
    }
  }
  // Hergebruik de dag-swipe-hook: ±1 stap = ±1 week. Tijdens slepen gelocked,
  // zodat een zijwaartse sleepbeweging niet ook de week wisselt.
  const panHandlers = useDaySwipe(weekIdx, (next) => goWeek(next - weekIdx), dragging)

  // 7 dagdatums (Ma–Zo) van de actieve week.
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => toDateString(addDays(fromDateString(weekMonday), i))),
    [weekMonday],
  )

  // Trainingen van de week (zonder rust/werk) — basis voor km + verdeling + kopie.
  const sessions = useMemo(
    () => allActivities.filter(
      a => weekDates.includes(a.datum) && a.type !== 'work' && a.type !== 'rest',
    ),
    [allActivities, weekDates],
  )

  const planKm = useMemo(
    () => Math.round(sessions.reduce((s, a) => s + (a.km ?? 0), 0)),
    [sessions],
  )

  // Volume per categorie (run-subcategorie of type), alleen km > 0.
  const segments = useMemo(() => {
    const totals = new Map<string, number>()
    for (const a of sessions) {
      const km = a.km ?? 0
      if (km <= 0) continue
      const key = volumeCategory(a)
      totals.set(key, (totals.get(key) ?? 0) + km)
    }
    return [...totals.entries()]
      .map(([key, km]) => ({ key, km: Math.round(km) }))
      .sort((a, b) => b.km - a.km)
  }, [sessions])

  const segSum = segments.reduce((s, x) => s + x.km, 0) || 1

  const firstEmptyDatum = useMemo(() => {
    const occupied = new Set(allActivities.filter(a => a.type !== 'work').map(a => a.datum))
    return weekDates.find(d => !occupied.has(d)) ?? weekMonday
  }, [allActivities, weekDates, weekMonday])

  function handleCopyWeek() {
    // Races niet meekopiëren — alleen de andere trainingen.
    const copySessions = sessions.filter(a => a.type !== 'race')
    if (!copySessions.length) {
      showToast('Geen activiteiten om te kopiëren')
      return
    }
    setClipboard({ sourceMonday: weekMonday, sourceNum: weekMeta?.num ?? 0, sessions: copySessions })
    showToast('Week gekopieerd — kies een week om te plakken')
  }

  async function handlePaste() {
    if (!clipboard || !schemaId || pasting) return
    setPasting(true)
    const srcMon = fromDateString(clipboard.sourceMonday)
    const tgtMon = fromDateString(weekMonday)
    const inputs: ActivityCreateInput[] = clipboard.sessions.map(a => {
      const dayIdx = Math.round((fromDateString(a.datum).getTime() - srcMon.getTime()) / 86400000)
      return copyInput(a, toDateString(addDays(tgtMon, dayIdx)))
    })
    try {
      const created = await createActivitiesBatch(schemaId, inputs)
      created.forEach(upsertActivity)
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast(`Geplakt in week ${weekMeta?.num ?? ''}`.trim())
    } catch {
      showToast('Plakken mislukt, probeer opnieuw.')
    } finally {
      setPasting(false)
    }
  }

  const onSourceWeek = clipboard?.sourceMonday === weekMonday

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <PageContainer>
        {/* Terug-header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headLeft} onPress={onBack} activeOpacity={0.7}>
            <View style={[styles.squareBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.squareBtnText, { color: theme.text }]}>‹</Text>
            </View>
            <View>
              <Text style={[styles.headTitle, { color: theme.text }]}>
                Week {weekMeta?.num ?? '—'}
              </Text>
              <Text style={[styles.headRange, { color: theme.muted }]}>{weekRange(weekMonday)}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.squareBtn, { backgroundColor: theme.text }]}
            onPress={() => setAddOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.squareBtnText, { color: theme.bg }]}>+</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          scrollEnabled={!dragging}
          {...panHandlers}
        >
          {/* 1. Weekblokken over de hele looptijd — tik om te wisselen */}
          <View style={styles.blocksWrap}>
            <WeekBlocks weeks={displayWeeks} activeMonday={weekMonday} onPickWeek={onJumpToWeek} futureFrom={weeks.length} />
          </View>

          {/* Onderstaande inhoud schuift mee bij week-wissel */}
          <Animated.View style={swipeAnim.style}>
            {/* 2. Verdeling per type-balkje */}
            <View style={[styles.buildHead, { borderBottomColor: theme.border }]}>
              <View style={styles.buildTopRow}>
                <Text style={[styles.buildLabel, { color: theme.muted }]}>week-opbouw</Text>
                <Text style={[styles.buildKm, { color: theme.text }]}>{planKm} km</Text>
              </View>

              <View style={styles.volTrack}>
                {segments.map(seg => (
                  <View
                    key={seg.key}
                    style={{
                      flex: seg.km / segSum,
                      backgroundColor: categoryColor(seg.key, theme),
                      borderRadius: 999,
                    }}
                  />
                ))}
                {!segments.length && <View style={[styles.volEmpty, { backgroundColor: theme.border }]} />}
              </View>

              <View style={styles.legend}>
                {segments.map(seg => (
                  <View key={seg.key} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: categoryColor(seg.key, theme) }]} />
                    <Text style={[styles.legendText, { color: theme.muted }]}>
                      {categoryLabel(seg.key)} {seg.km}km
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Kopieer / plak */}
            <View style={styles.actionRow}>
              {clipboard ? (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.accent }, pasting && { opacity: 0.5 }]}
                    onPress={handlePaste}
                    activeOpacity={0.85}
                    disabled={pasting}
                  >
                    <Text style={[styles.actionBtnText, { color: theme.accentInk }]}>
                      {pasting
                        ? 'Plakken…'
                        : onSourceWeek
                          ? `Plak nogmaals (week ${clipboard.sourceNum})`
                          : `Plak week ${clipboard.sourceNum} hier`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                    onPress={() => setClipboard(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.cancelBtnText, { color: theme.muted }]}>×</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
                  onPress={handleCopyWeek}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.actionBtnText, { color: theme.text2 }]}>Kopieer week</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 3. Versleepbare week-overzicht */}
            <View style={styles.stripWrap}>
              <WeekDragStrip
                weekDates={weekDates}
                activities={allActivities}
                selectedDate={today}
                onOpenActivity={setSheetActivity}
                onDragChange={setDragging}
              />
            </View>
          </Animated.View>

          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      </PageContainer>

      <ActivityActionSheet
        activity={sheetActivity}
        onClose={() => setSheetActivity(null)}
        onEdit={(a) => { setSheetActivity(null); onEditActivity(a) }}
      />

      <AddActivityModal
        visible={addOpen}
        prefillDate={firstEmptyDatum}
        onClose={() => setAddOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root:        { flex: 1 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: 6, paddingBottom: 10 },
  headLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  squareBtn:   { width: 32, height: 32, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  squareBtnText:{ fontFamily: Fonts.displaySemiBold, fontSize: 17, lineHeight: 20 },
  headTitle:   { fontFamily: Fonts.displayBold, fontSize: 17, letterSpacing: -0.3 },
  headRange:   { fontFamily: Fonts.display, fontSize: 12, marginTop: 1 },

  scroll:      { paddingTop: 4 },
  blocksWrap:  { paddingHorizontal: Spacing.lg, paddingBottom: 14 },

  buildHead:   { paddingHorizontal: Spacing.lg, paddingBottom: 12, borderBottomWidth: 1 },
  buildTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  buildLabel:  { fontFamily: Fonts.display, fontSize: 12.5 },
  buildKm:     { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.3 },

  volTrack:    { flexDirection: 'row', height: 6, borderRadius: 999, overflow: 'hidden', gap: 2 },
  volEmpty:    { flex: 1, borderRadius: 999 },
  legend:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 7 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:   { width: 7, height: 7, borderRadius: 999 },
  legendText:  { fontFamily: Fonts.display, fontSize: 11 },

  actionRow:   { flexDirection: 'row', gap: 7, paddingHorizontal: Spacing.lg, paddingTop: 10, paddingBottom: 4 },
  actionBtn:   { flex: 1, borderRadius: 9, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  actionBtnText:{ fontFamily: Fonts.displaySemiBold, fontSize: 12.5 },
  cancelBtn:   { width: 40, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText:{ fontFamily: Fonts.displaySemiBold, fontSize: 18, lineHeight: 20 },

  stripWrap:   { paddingHorizontal: Spacing.md, paddingTop: 12 },
})
