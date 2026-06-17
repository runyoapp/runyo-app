import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/hooks/useTheme'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { patchActivity } from '@/services/activities'
import { ActivityColors, Fonts, Spacing, Radius, type Theme } from '@/constants/theme'
import { DAYS_NL, getWeekDates, toDateString } from '@/utils/date'
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
  isPast: boolean
  // Alle echte trainingen van die dag (rust/werk tellen niet mee). Een dag kan er
  // meerdere hebben — verslepen kan dus ook landen op een al bezette dag.
  sessions: Activity[]
}

type Rect = { x: number; y: number; width: number; height: number }

const ROW_GAP = 4
const LONG_PRESS_MS = 250

function buildWeek(activities: Activity[], selectedDate: string): DayCell[] {
  const dates = getWeekDates(0)
  const todayStr = toDateString(new Date())
  return dates.map((datum, i) => {
    const sessions = activities.filter(
      a => a.datum === datum && a.type !== 'rest' && a.type !== 'work',
    )
    return {
      datum,
      label: DAYS_NL[i],
      dayNum: Number(datum.slice(8, 10)),
      isSelected: datum === selectedDate,
      isPast: datum < todayStr,
      sessions,
    }
  })
}

function catColor(type: ActivityType, theme: Theme): string {
  return ActivityColors[type]?.text ?? theme.accent
}

// Inklapbare "Deze week"-strip. Ingeklapt: dag-dots als context. Uitgeklapt:
// volledige weekstrip waarin je een sessie kunt vastpakken (houd vast → sleep) en
// op een andere dag laat vallen → reschedule (datum-patch + optimistic update).
// Landen op een al bezette dag mag: de verplaatste sessie wipt er vloeiend tussen.
//
// Drag = react-native-gesture-handler (Gesture.Pan), net als het oude week-tabblad:
// .activateAfterLongPress laat losse tikken (→ details) en verticaal scrollen met
// rust; hit-testen op absolute scherm-coördinaten tegen gemeten rij-rects werkt
// betrouwbaar op web én touch.
export function RescheduleWeek({ activities, selectedDate, onOpenActivity }: Props) {
  const theme          = useTheme()
  const schemaId       = useDataStore(s => s.schemaId)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const showToast      = useUiStore(s => s.showToast)
  const queryClient    = useQueryClient()

  const [open,        setOpen]        = useState(false)
  const [dragId,      setDragId]      = useState<string | null>(null)
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null)
  const [hoverIdx,    setHoverIdx]    = useState<number | null>(null)
  // Net-verplaatste sessie → krijgt de in-spring-animatie op de nieuwe dag.
  const [justMovedId, setJustMovedId] = useState<string | null>(null)
  // Ghost-positie, lokaal binnen de strip (abs scherm-coord − strip-oorsprong).
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)

  const week = useMemo(() => buildWeek(activities, selectedDate), [activities, selectedDate])

  // Refs zodat de runOnJS-gesturecallbacks de actuele week/drag-bron zien.
  const weekRef        = useRef(week); weekRef.current = week
  const dragActivityRef = useRef<Activity | null>(null)
  const clearTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Drop-doelen: per dag-index de scherm-rect (measureInWindow) + de View-refs.
  const stripRef    = useRef<View>(null)
  const stripOrigin = useRef({ x: 0, y: 0 })
  const rowRefs     = useRef<Map<number, View | null>>(new Map())
  const rowRects    = useRef<Map<number, Rect>>(new Map())

  useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current) }, [])

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

  async function commitMove(activity: Activity, toIdx: number) {
    const target = weekRef.current[toIdx]
    if (!target || !schemaId || target.datum === activity.datum) return

    // Markeer als net-verplaatst → de pill mount op de nieuwe dag met de in-animatie.
    setJustMovedId(activity.id)
    if (clearTimer.current) clearTimeout(clearTimer.current)
    clearTimer.current = setTimeout(() => setJustMovedId(null), 600)

    upsertActivity({ ...activity, datum: target.datum })   // optimistic
    try {
      await patchActivity(schemaId, activity.id, { datum: target.datum })
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast(`Verplaatst naar ${target.label} ${target.dayNum}`)
    } catch {
      upsertActivity(activity)             // rollback
      setJustMovedId(null)
      showToast('Verplaatsen mislukt, probeer opnieuw.')
    }
  }

  function handleStart(activity: Activity, fromIdx: number, absX: number, absY: number) {
    measureTargets()
    dragActivityRef.current = activity
    setDragId(activity.id)
    setDragFromIdx(fromIdx)
    setHoverIdx(fromIdx)
    setGhost({ x: absX - stripOrigin.current.x, y: absY - stripOrigin.current.y })
  }

  function handleMove(absX: number, absY: number) {
    setGhost({ x: absX - stripOrigin.current.x, y: absY - stripOrigin.current.y })
    setHoverIdx(hitTest(absX, absY))
  }

  function handleEnd(absX: number, absY: number, cancelled: boolean) {
    const activity = dragActivityRef.current
    dragActivityRef.current = null
    setDragId(null)
    setDragFromIdx(null)
    setHoverIdx(null)
    setGhost(null)
    if (cancelled || !activity) return
    const to = hitTest(absX, absY)
    if (to != null && weekRef.current[to] && weekRef.current[to].datum !== activity.datum) {
      void commitMove(activity, to)
    }
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
              {d.sessions[0] && (
                <View
                  style={[
                    styles.dotInner,
                    { backgroundColor: d.isSelected ? theme.accent : catColor(d.sessions[0].type, theme) },
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
            {dragId != null ? 'laat los op een dag' : 'houd een sessie vast om te verplaatsen'}
          </Text>

          <View ref={stripRef} style={styles.strip} collapsable={false}>
            {week.map((d, i) => {
              const isTgt = dragId != null && hoverIdx === i && i !== dragFromIdx

              return (
                <View
                  key={d.datum}
                  ref={r => { rowRefs.current.set(i, r) }}
                  collapsable={false}
                  style={[
                    styles.row,
                    isTgt && { backgroundColor: theme.accentGlow },
                    // Verleden-dagen iets lichter (tenzij ze nu drop-doel zijn).
                    d.isPast && !isTgt && styles.rowPast,
                  ]}
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
                    {d.sessions.length > 0 ? (
                      d.sessions.map(session => {
                        const isSrc = dragId === session.id
                        // Pan op de hele pill, activeert pas na korte houd-druk:
                        // losse tik valt door naar onPress (details), vasthouden → sleep.
                        const pan = Gesture.Pan()
                          .activateAfterLongPress(LONG_PRESS_MS)
                          .runOnJS(true)
                          .onStart(e => handleStart(session, i, e.absoluteX, e.absoluteY))
                          .onUpdate(e => handleMove(e.absoluteX, e.absoluteY))
                          .onEnd(e => handleEnd(e.absoluteX, e.absoluteY, false))
                          .onFinalize((e, success) => { if (!success) handleEnd(e.absoluteX, e.absoluteY, true) })

                        return (
                          <GestureDetector key={session.id} gesture={pan}>
                            <Pressable
                              style={{ opacity: isSrc ? 0.25 : 1 }}
                              onPress={() => onOpenActivity(session)}
                            >
                              <SessionPill
                                session={session}
                                theme={theme}
                                animateIn={justMovedId === session.id}
                              />
                            </Pressable>
                          </GestureDetector>
                        )
                      })
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
            {dragId != null && ghost && dragActivityRef.current && (
              <View
                pointerEvents="none"
                style={[styles.ghost, { left: ghost.x - 60, top: ghost.y - 18 }]}
              >
                <View style={styles.ghostInner}>
                  <SessionPill session={dragActivityRef.current} theme={theme} dragging />
                </View>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  )
}

function SessionPill({ session, theme, dragging = false, animateIn = false }: {
  session: Activity; theme: Theme; dragging?: boolean; animateIn?: boolean
}) {
  // In-spring: opacity + lichte translateY/scale wanneer de pill net op deze dag
  // is geland (justMovedId). Anders meteen op de eindstand (geen animatie).
  const anim = useRef(new Animated.Value(animateIn ? 0 : 1)).current
  useEffect(() => {
    if (!animateIn) return
    anim.setValue(0)
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }).start()
  }, [animateIn, anim])

  const animStyle = animateIn
    ? {
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
        ],
      }
    : null

  return (
    <Animated.View style={[styles.pillWrap, animStyle]}>
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
    </Animated.View>
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
  rowPast:     { opacity: 0.5 },
  dayCol:      { width: 38, alignItems: 'center' },
  dayName:     { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 0.4 },
  dayNum:      { fontSize: 17, letterSpacing: -0.3, marginTop: 1 },
  slot:        { flex: 1, minHeight: 30, justifyContent: 'center', gap: ROW_GAP },
  empty:       { height: 30, borderRadius: 9, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', paddingLeft: 12 },
  emptyText:   { fontFamily: Fonts.display, fontSize: 12 },

  pillWrap:    { },
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
