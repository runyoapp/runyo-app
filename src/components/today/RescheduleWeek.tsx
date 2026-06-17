import { useMemo, useRef, useState } from 'react'
import {
  View, Text, Pressable, Animated, PanResponder, StyleSheet,
  type LayoutChangeEvent,
} from 'react-native'
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

type DragState = {
  fromIdx: number
  overIdx: number
}

const ROW_GAP = 4

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
// volledige weekstrip waarin je een sessie kunt vastpakken (PanResponder) en op
// een vrije dag laat vallen → reschedule (datum-patch + optimistic update).
// Spec: runyo-vandaag.jsx RescheduleWeek.
export function RescheduleWeek({ activities, selectedDate, onOpenActivity }: Props) {
  const theme          = useTheme()
  const schemaId       = useDataStore(s => s.schemaId)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const showToast      = useUiStore(s => s.showToast)
  const queryClient    = useQueryClient()

  const [open, setOpen] = useState(false)
  const [drag, setDrag] = useState<DragState | null>(null)

  const week = useMemo(() => buildWeek(activities, selectedDate), [activities, selectedDate])

  // Y-posities van de rijen binnen de strip — RN-equivalent van getBoundingClientRect.
  const rowY = useRef<number[]>([])
  // Refs zodat de eenmalig-gemaakte PanResponder de actuele week/drag ziet.
  const weekRef = useRef(week); weekRef.current = week
  const dragRef = useRef<DragState | null>(null)

  const ghostY = useRef(new Animated.Value(0)).current
  const stripTopRef = useRef(0)

  function rowToIdx(y: number): number {
    const ys = rowY.current
    for (let i = ys.length - 1; i >= 0; i--) {
      if (y >= ys[i]) return i
    }
    return 0
  }

  async function commitMove(fromIdx: number, toIdx: number) {
    const w = weekRef.current
    const session = w[fromIdx].session
    const target  = w[toIdx]
    if (!session || target.session || !schemaId) return

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

  // Eén strip-brede PanResponder. Een verticale sleep wordt via de CAPTURE-fase
  // overgenomen — ook van de Pressables op de sessies — zodat slepen werkt; losse
  // tikken (geen beweging) vallen door naar de Pressable.onPress (→ details).
  // Slepen start alleen op een rij die een sessie heeft.
  const panResponder = PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_e, g) => {
        if (Math.abs(g.dy) <= 6 || Math.abs(g.dy) < Math.abs(g.dx)) return false
        const fromIdx = rowToIdx(g.y0 - stripTopRef.current)
        return !!weekRef.current[fromIdx]?.session
      },
      onPanResponderGrant: (e, g) => {
        const fromIdx = rowToIdx(g.y0 - stripTopRef.current)
        const localY  = e.nativeEvent.pageY - stripTopRef.current
        ghostY.setValue(localY)
        dragRef.current = { fromIdx, overIdx: fromIdx }
        setDrag({ fromIdx, overIdx: fromIdx })
      },
      onPanResponderMove: (e) => {
        const localY = e.nativeEvent.pageY - stripTopRef.current
        ghostY.setValue(localY)
        const over = rowToIdx(localY)
        if (dragRef.current && dragRef.current.overIdx !== over) {
          dragRef.current = { ...dragRef.current, overIdx: over }
          setDrag({ ...dragRef.current })
        }
      },
      onPanResponderRelease: () => {
        const d = dragRef.current
        if (d && d.overIdx !== d.fromIdx && !weekRef.current[d.overIdx].session) {
          void commitMove(d.fromIdx, d.overIdx)
        }
        dragRef.current = null
        setDrag(null)
      },
      onPanResponderTerminate: () => {
        dragRef.current = null
        setDrag(null)
      },
  })

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
            {drag ? 'laat los op een vrije dag' : 'houd een sessie vast om te verplaatsen'}
          </Text>

          <View
            style={styles.strip}
            onLayout={(e: LayoutChangeEvent) => {
              e.currentTarget.measureInWindow((_x, y) => { stripTopRef.current = y })
            }}
            {...panResponder.panHandlers}
          >
            {week.map((d, i) => {
              const isSrc = drag?.fromIdx === i
              const isTgt = !!drag && drag.overIdx === i && i !== drag.fromIdx && !d.session

              return (
                <View
                  key={d.datum}
                  style={[
                    styles.row,
                    isTgt && { backgroundColor: theme.accentGlow },
                  ]}
                  onLayout={(e: LayoutChangeEvent) => { rowY.current[i] = e.nativeEvent.layout.y }}
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
                      <Pressable
                        style={{ opacity: isSrc ? 0.25 : 1 }}
                        onPress={() => onOpenActivity(d.session!)}
                      >
                        <SessionPill session={d.session} theme={theme} />
                      </Pressable>
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

            {/* Zwevende sleep-ghost */}
            {drag && (
              <Animated.View
                pointerEvents="none"
                style={[styles.ghost, { transform: [{ translateY: ghostY }] }]}
              >
                <View style={styles.ghostInner}>
                  <SessionPill session={week[drag.fromIdx].session!} theme={theme} dragging />
                </View>
              </Animated.View>
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
