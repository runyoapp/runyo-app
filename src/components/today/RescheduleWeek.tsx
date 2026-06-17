import { useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/hooks/useTheme'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { patchActivity } from '@/services/activities'
import { ActivityColors, Fonts, Spacing, Radius, type Theme } from '@/constants/theme'
import { DAYS_NL, getWeekDates } from '@/utils/date'
import { TYPE_DISPLAY, type ActivityType } from '@/constants/activities'
import type { Activity } from '@/types/activity'

function typeLabel(type: ActivityType): string {
  return TYPE_DISPLAY[type]?.nl ?? type
}

type Props = {
  activities: Activity[]
  // Geselecteerde dag (YYYY-MM-DD) — bepaalt welke dag-stip oplicht; volgt het swipen.
  selectedDate: string
  // Tik op een sessie → details tonen (afgehandeld door TodayScreen).
  onOpenActivity: (activity: Activity) => void
}

type DayCell = {
  datum: string
  label: string
  dayNum: number
  isSelected: boolean
  // Eerste echte training van die dag (rust/werk tellen niet als verplaatsbare sessie).
  session: Activity | null
}

type Rect = { x: number; y: number; width: number; height: number }

const ROW_GAP = 4
const LONG_PRESS_MS = 250

function buildWeek(activities: Activity[], selectedDate: string): DayCell[] {
  const dates = getWeekDates(0)
  return dates.map((datum, i) => {
    const session = activities.find(
      a => a.datum === datum && a.type !== 'rest' && a.type !== 'work',
    ) ?? null
    return {
      datum,
      label: DAYS_NL[i],
      dayNum: Number(datum.slice(8, 10)),
      isSelected: datum === selectedDate,
      session,
    }
  })
}

function catColor(type: ActivityType, theme: Theme): string {
  return ActivityColors[type]?.text ?? theme.accent
}

// Inklapbare "Deze week"-strip. Ingeklapt: dag-dots als context. Uitgeklapt:
// volledige weekstrip waarin je een sessie kunt vastpakken (houd vast → sleep) en
// op een vrije dag laat vallen → reschedule (datum-patch + optimistic update).
//
// Drag = react-native-gesture-handler (Gesture.Pan), net als het oude week-tabblad:
// .activateAfterLongPress laat losse tikken (→ details) en verticaal scrollen met
// rust, en hit-testen gebeurt op absolute scherm-coördinaten tegen gemeten rij-rects
// — werkt betrouwbaar op web én touch (de oude PanResponder + pageY deed dat niet).
export function RescheduleWeek({ activities, selectedDate, onOpenActivity }: Props) {
  const theme          = useTheme()
  const schemaId       = useDataStore(s => s.schemaId)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const showToast      = useUiStore(s => s.showToast)
  const queryClient    = useQueryClient()

  const [open,    setOpen]    = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  // Ghost-positie, lokaal binnen de strip (abs scherm-coord − strip-oorsprong).
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)

  const week = useMemo(() => buildWeek(activities, selectedDate), [activities, selectedDate])

  // Refs zodat de runOnJS-gesturecallbacks de actuele week/drag-bron zien.
  const weekRef    = useRef(week); weekRef.current = week
  const dragIdxRef = useRef<number | null>(null)

  // Drop-doelen: per rij-index de scherm-rect (measureInWindow) + de View-refs.
  const stripRef    = useRef<View>(null)
  const stripOrigin = useRef({ x: 0, y: 0 })
  const rowRefs     = useRef<Map<number, View | null>>(new Map())
  const rowRects    = useRef<Map<number, Rect>>(new Map())

  function measureTargets() {
    stripRef.current?.measureInWindow((x, y) => { stripOrigin.current = { x, y } })
    rowRefs.current.forEach((ref, i) => {
      ref?.measureInWindow((x, y, width, height) => { rowRects.current.set(i, { x, y, width, height }) })
    })
  }

  function hitTest(absX: number, absY: number): number | null {
    for (const [i, r] of rowRects.current) {
      if (absX >= r.x && absX <= r.x + r.width && absY >= r.y && absY <= r.y + r.height) return i
    }
    return null
  }

  async function commitMove(fromIdx: number, toIdx: number) {
    const w = weekRef.current
    const session = w[fromIdx]?.session
    const target  = w[toIdx]
    if (!session || !target || target.session || !schemaId) return

    const moved = { ...session, datum: target.datum }
    upsertActivity(moved)                 // optimistic
    try {
      await patchActivity(schemaId, session.id, { datum: target.datum })
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast(`Verplaatst naar ${target.label} ${target.dayNum}`)
    } catch {
      upsertActivity(session)             // rollback
      showToast('Verplaatsen mislukt, probeer opnieuw.')
    }
  }

  function handleStart(idx: number, absX: number, absY: number) {
    measureTargets()
    dragIdxRef.current = idx
    setDragIdx(idx)
    setHoverIdx(idx)
    setGhost({ x: absX - stripOrigin.current.x, y: absY - stripOrigin.current.y })
  }

  function handleMove(absX: number, absY: number) {
    setGhost({ x: absX - stripOrigin.current.x, y: absY - stripOrigin.current.y })
    setHoverIdx(hitTest(absX, absY))
  }

  function handleEnd(absX: number, absY: number, cancelled: boolean) {
    const from = dragIdxRef.current
    dragIdxRef.current = null
    setDragIdx(null)
    setHoverIdx(null)
    setGhost(null)
    if (cancelled || from == null) return
    const to = hitTest(absX, absY)
    if (to != null && to !== from && !weekRef.current[to]?.session) void commitMove(from, to)
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Header — altijd zichtbaar, tikbaar; dag-dots als compacte context */}
      <Pressable style={styles.header} onPress={() => setOpen(o => !o)}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Deze week</Text>
        <View style={styles.dots}>
          {week.map(d => (
            <View
              key={d.datum}
              style={[
                styles.dot,
                {
                  width: d.isSelected ? 22 : 18,
                  height: d.isSelected ? 22 : 18,
                  backgroundColor: d.isSelected ? theme.text : theme.surface2,
                  borderColor: d.isSelected ? theme.text : theme.border,
                },
              ]}
            >
              {d.session && (
                <View
                  style={[
                    styles.dotInner,
                    { backgroundColor: d.isSelected ? theme.accent : catColor(d.session.type, theme) },
                  ]}
                />
              )}
            </View>
          ))}
        </View>
        <Text style={[styles.chevron, { color: theme.muted }, open && styles.chevronOpen]}>›</Text>
      </Pressable>

      {/* Uitgeklapt: volledige reschedule-week */}
      {open && (
        <View style={[styles.body, { borderTopColor: theme.border }]}>
          <Text style={[styles.hint, { color: theme.muted }]}>
            {dragIdx != null ? 'laat los op een vrije dag' : 'houd een sessie vast om te verplaatsen'}
          </Text>

          <View ref={stripRef} style={styles.strip} collapsable={false}>
            {week.map((d, i) => {
              const isSrc = dragIdx === i
              const isTgt = dragIdx != null && hoverIdx === i && i !== dragIdx && !d.session

              const pill = d.session && (
                <Pressable
                  style={{ opacity: isSrc ? 0.25 : 1 }}
                  onPress={() => onOpenActivity(d.session!)}
                >
                  <SessionPill session={d.session} theme={theme} />
                </Pressable>
              )

              // Pan zit op de hele pill, maar activeert pas na een korte houd-druk:
              // losse tik valt door naar onPress (details), vasthouden → sleep.
              const pan = Gesture.Pan()
                .activateAfterLongPress(LONG_PRESS_MS)
                .runOnJS(true)
                .onStart(e => handleStart(i, e.absoluteX, e.absoluteY))
                .onUpdate(e => handleMove(e.absoluteX, e.absoluteY))
                .onEnd(e => handleEnd(e.absoluteX, e.absoluteY, false))
                .onFinalize((e, success) => { if (!success) handleEnd(e.absoluteX, e.absoluteY, true) })

              return (
                <View
                  key={d.datum}
                  ref={r => { rowRefs.current.set(i, r) }}
                  collapsable={false}
                  style={[styles.row, isTgt && { backgroundColor: theme.accentGlow }]}
                >
                  <View style={styles.dayCol}>
                    <Text style={[styles.dayName, { color: d.isSelected ? theme.accent : theme.muted }]}>
                      {d.label.toUpperCase()}
                    </Text>
                    <Text style={[styles.dayNum, {
                      color: d.isSelected ? theme.text : theme.text2,
                      fontFamily: d.isSelected ? Fonts.displayBold : Fonts.displaySemiBold,
                    }]}>
                      {d.dayNum}
                    </Text>
                  </View>

                  <View style={styles.slot}>
                    {d.session ? (
                      <GestureDetector gesture={pan}>
                        {pill as React.ReactElement}
                      </GestureDetector>
                    ) : (
                      <View style={[
                        styles.empty,
                        { borderColor: isTgt ? theme.accent : theme.border },
                      ]}>
                        <Text style={[styles.emptyText, { color: isTgt ? theme.accent : theme.muted }]}>
                          {isTgt ? 'hierheen' : 'rustdag'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )
            })}

            {/* Zwevende sleep-ghost — volgt de vinger binnen de strip */}
            {dragIdx != null && ghost && week[dragIdx].session && (
              <View
                pointerEvents="none"
                style={[styles.ghost, { left: ghost.x - 60, top: ghost.y - 18 }]}
              >
                <View style={styles.ghostInner}>
                  <SessionPill session={week[dragIdx].session!} theme={theme} dragging />
                </View>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  )
}

function SessionPill({ session, theme, dragging = false }: {
  session: Activity; theme: Theme; dragging?: boolean
}) {
  return (
    <View style={[styles.pill, {
      backgroundColor: dragging ? theme.surface : theme.surface2,
      borderColor: dragging ? theme.accent : theme.border,
    }, dragging && styles.pillDragging]}>
      <View style={[styles.pillBar, { backgroundColor: catColor(session.type, theme) }]} />
      <View style={styles.pillBody}>
        <Text style={[styles.pillTitle, { color: theme.text }]} numberOfLines={1}>
          {session.titel || typeLabel(session.type)}
        </Text>
        <Text style={[styles.pillMeta, { color: theme.muted }]} numberOfLines={1}>
          {session.km != null ? `${session.km} km` : typeLabel(session.type)}
        </Text>
      </View>
      <View style={styles.grip}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.gripLine, { backgroundColor: theme.text }]} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card:        { borderWidth: 1, borderRadius: Radius.lg, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, overflow: 'hidden' },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  headerTitle: { flex: 1, fontFamily: Fonts.displayBold, fontSize: 14, letterSpacing: -0.2 },
  dots:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:         { borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dotInner:    { width: 6, height: 6, borderRadius: 3 },
  chevron:     { fontFamily: Fonts.display, fontSize: 16, marginLeft: 2 },
  chevronOpen: { transform: [{ rotate: '90deg' }] },

  body:        { borderTopWidth: 1, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10 },
  hint:        { fontFamily: Fonts.display, fontSize: 11.5, marginBottom: 8 },
  strip:       { gap: ROW_GAP, position: 'relative' },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingHorizontal: 6, borderRadius: Radius.md },
  dayCol:      { width: 38, alignItems: 'center' },
  dayName:     { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 0.4 },
  dayNum:      { fontSize: 17, letterSpacing: -0.3, marginTop: 1 },
  slot:        { flex: 1, minHeight: 30, justifyContent: 'center' },
  empty:       { height: 30, borderRadius: 9, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', paddingLeft: 12 },
  emptyText:   { fontFamily: Fonts.display, fontSize: 12 },

  pill:        { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 11 },
  pillDragging:{ shadowColor: '#0E1F1A', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  pillBar:     { width: 4, height: 26, borderRadius: 2 },
  pillBody:    { flex: 1, minWidth: 0 },
  pillTitle:   { fontFamily: Fonts.displaySemiBold, fontSize: 13.5, letterSpacing: -0.1 },
  pillMeta:    { fontFamily: Fonts.mono, fontSize: 10.5, marginTop: 1 },
  grip:        { gap: 2.5, opacity: 0.4 },
  gripLine:    { width: 13, height: 1.5, borderRadius: 1 },

  ghost:       { position: 'absolute', left: 48, right: 0, top: -15 },
  ghostInner:  { maxWidth: 300 },
})
