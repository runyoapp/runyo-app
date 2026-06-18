import { useState, useRef, useEffect, memo } from 'react'
import { View, Text, Pressable, Animated, Easing, PanResponder, StyleSheet } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg'
import { useTheme } from '@/hooks/useTheme'
import { useDataStore } from '@/stores/dataStore'
import { Fonts, Spacing, ActivityColors, type Theme } from '@/constants/theme'
import { raceCountdown, MONTHS_NL } from '@/utils/date'
import { derivePace, weekProgress, type WeekProgress } from '@/utils/raceProgress'
import type { Activity } from '@/types/activity'

type Props = {
  onRacePress: (activity: Activity) => void
  // Lege staat (schema, maar geen geplande race): tik → nieuwe race toevoegen.
  onAddRace?: () => void
}

// Race chip — spec: claude design "runyo race chip.html" → ChipA4B7cSwipe.
// Ingeklapt: forest-tegel met countdown + taper-streepje. Tik → klapt open tot
// week-voortgangsbalk + doeltijd; swipe of pijltjes bladeren door geplande races.
// Lang ingedrukt op een race → bewerken (RaceModal via onRacePress).
const FOREST_A = '#234A3E'
const FOREST_B = '#14302A'
const MINT     = '#3DDFB1'
const MINT_DIM = 'rgba(127,242,201,0.85)'
const EASE     = Easing.bezier(0.4, 0, 0.2, 1)

function fmtDate(datum: string): string {
  const [, mm, dd] = datum.split('-')
  return `${parseInt(dd, 10)} ${MONTHS_NL[parseInt(mm, 10) - 1]}`
}

function fmtKm(km: number): string {
  return km % 1 === 0 ? String(km) : km.toFixed(1).replace('.', ',')
}

// A2: RacesBar abonneert zelf op activities i.p.v. ze als prop te ontvangen,
// zodat een activiteit-update de header-component (AppHeader) op elk scherm niet
// meer laat herrenderen — alleen deze (SVG-)component reageert nog. memo voorkomt
// daarnaast een rerender wanneer AppHeader om een andere reden hertekent.
function RacesBarInner({ onRacePress, onAddRace }: Props) {
  const theme      = useTheme()
  const activities = useDataStore(s => s.activities)
  const schemaList = useDataStore(s => s.schemaList)

  const [open,   setOpen]   = useState(false)
  const [idx,    setIdx]    = useState(0)
  const [bodyH,  setBodyH]  = useState(0)

  const anim   = useRef(new Animated.Value(0)).current
  const swapX  = useRef(new Animated.Value(0)).current
  const swapO  = useRef(new Animated.Value(1)).current
  const prevIdx = useRef(0)

  const today = new Date().toISOString().split('T')[0]
  const races = activities
    .filter(a => a.type === 'race' && a.datum >= today)
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .slice(0, 5)
  const safeIdx = races.length ? Math.min(idx, races.length - 1) : 0

  const go = (d: number) => {
    const n = safeIdx + d
    if (n >= 0 && n < races.length) setIdx(n)
  }
  // Refs zodat de eenmalig-gemaakte PanResponder de actuele waarden ziet.
  const openRef = useRef(open); openRef.current = open
  const goRef   = useRef(go);   goRef.current = go

  // Open/dicht-morf (tegel groeit, voortgang vouwt open) — één geanimeerde waarde.
  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0, duration: 320, easing: EASE, useNativeDriver: false,
    }).start()
  }, [open, anim])

  // Carrousel-wissel: korte schuif-fade bij het bladeren tussen races.
  useEffect(() => {
    if (prevIdx.current === safeIdx) return
    const dir = safeIdx > prevIdx.current ? 1 : -1
    prevIdx.current = safeIdx
    swapX.setValue(dir * 14)
    swapO.setValue(0.4)
    Animated.parallel([
      Animated.timing(swapX, { toValue: 0, duration: 260, easing: EASE, useNativeDriver: true }),
      Animated.timing(swapO, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start()
  }, [safeIdx, swapX, swapO])

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, g) =>
      openRef.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderRelease: (_e, g) => {
      if (g.dx > 40) goRef.current(-1)
      else if (g.dx < -40) goRef.current(1)
    },
  })).current

  // Geen geplande race: wie wél een schema heeft krijgt een slanke "race plannen"-CTA
  // (i.p.v. een verdwenen balk zonder uitleg). Zonder schema blijft de balk weg.
  if (!races.length) {
    if (!schemaList.length || !onAddRace) return null
    return <AddRaceBar theme={theme} onPress={onAddRace} />
  }

  const r       = races[safeIdx]
  const cd      = raceCountdown(r.datum)
  const big     = cd.val.length >= 3 || Number.isNaN(Number(cd.val))
  const pace    = derivePace(r.goalTime, r.km)
  const prog    = weekProgress(r, schemaList, activities)
  const hasDoel = !!r.goalTime
  const hasFold = !!prog || races.length > 1

  // Interpolaties op de open/dicht-waarde.
  const i = (a: number, b: number) => anim.interpolate({ inputRange: [0, 1], outputRange: [a, b] })
  const tileSize      = i(44, 64)
  const numFont       = anim.interpolate({ inputRange: [0, 1], outputRange: big ? [19, 28] : [27, 38] })
  const numLine       = anim.interpolate({ inputRange: [0, 1], outputRange: big ? [21, 31] : [29, 41] })
  // Lange units ("maanden") passen niet op dezelfde maat → iets kleiner + nooit wrappen.
  const unitLong      = cd.unit.length >= 6
  const unitFont      = anim.interpolate({ inputRange: [0, 1], outputRange: unitLong ? [6.5, 10] : [7.5, 12] })
  const unitLine      = anim.interpolate({ inputRange: [0, 1], outputRange: unitLong ? [9, 13] : [10, 15] })
  const unitMargin    = i(-1, -2)
  const chevronRot    = anim.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '-90deg'] })
  const shadowOpacity = i(0, 0.1)
  const doelH         = i(0, 25)
  const foldH         = anim.interpolate({ inputRange: [0, 1], outputRange: [0, bodyH] })
  const sliverH       = i(3, 0)
  const sliverOpacity = i(1, 0)

  return (
    <View style={styles.outer} {...pan.panHandlers}>
      <Animated.View
        style={[styles.card, {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowOpacity,
          elevation: open ? 6 : 0,
        }]}
      >
        <Animated.View style={{ transform: [{ translateX: swapX }], opacity: swapO }}>
          {/* Header — tegel + naam/meta + chevron (tik = open/dicht) */}
          <Pressable
            onPress={() => setOpen(o => !o)}
            onLongPress={() => onRacePress(r)}
            style={styles.header}
          >
            <Animated.View style={[styles.tile, { width: tileSize, height: tileSize }]}>
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                <Defs>
                  <LinearGradient id="runyoForestTile" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={FOREST_A} />
                    <Stop offset="1" stopColor={FOREST_B} />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#runyoForestTile)" />
              </Svg>
              <Animated.Text style={{
                fontFamily: Fonts.displayBold, color: MINT,
                fontSize: numFont, lineHeight: numLine, letterSpacing: -1,
              }}>{cd.val}</Animated.Text>
              <Animated.Text numberOfLines={1} style={{
                fontFamily: Fonts.display, color: MINT_DIM, letterSpacing: unitLong ? 0.2 : 0.4,
                textTransform: 'uppercase', fontSize: unitFont, lineHeight: unitLine, marginTop: unitMargin,
              }}>{cd.unit}</Animated.Text>
            </Animated.View>

            <View style={styles.body}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {r.titel || fmtDate(r.datum)}
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>
                {fmtDate(r.datum)}{r.km != null ? ` · ${fmtKm(r.km)} km` : ''}
                {open && r.isMainGoal ? ' · Hoofddoel' : ''}
              </Text>
              {hasDoel && (
                <Animated.View style={{ height: doelH, opacity: anim, overflow: 'hidden' }}>
                  <View style={styles.doelRow}>
                    <View style={[styles.doelDot, { backgroundColor: theme.accent }]} />
                    <Text style={[styles.doelText, { color: theme.text2 }]}>
                      doel {r.goalTime}
                      {pace ? <Text style={{ color: theme.muted }}> · {pace}/km</Text> : null}
                    </Text>
                  </View>
                </Animated.View>
              )}
            </View>

            <Animated.View style={[styles.chevron, {
              backgroundColor: theme.surface2, borderColor: theme.border,
              transform: [{ rotate: chevronRot }],
            }]}>
              <Text style={[styles.chevronText, { color: theme.muted }]}>›</Text>
            </Animated.View>
          </Pressable>

          {/* Open: week-voortgangsbalk + carrousel-besturing */}
          {hasFold && (
            <Animated.View style={{ height: foldH, opacity: anim, overflow: 'hidden' }}>
              <View
                onLayout={e => {
                  const h = Math.round(e.nativeEvent.layout.height)
                  if (h && h !== bodyH) setBodyH(h)
                }}
                style={styles.fold}
              >
                {prog && <WeekBar prog={prog} theme={theme} />}
                {races.length > 1 && (
                  <Carousel idx={safeIdx} total={races.length} go={go} theme={theme} />
                )}
              </View>
            </Animated.View>
          )}

          {/* Ingeklapt: dunne taper-sliver onderlangs */}
          {prog && (
            <Animated.View style={{ height: sliverH, opacity: sliverOpacity, backgroundColor: theme.border }}>
              <View style={{
                width: `${(prog.done / prog.total) * 100}%`, height: '100%', backgroundColor: theme.accent,
              }} />
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>

      {open && (
        <Text style={[styles.hint, { color: theme.muted }]}>
          {races.length > 1 ? 'swipe of tik de pijltjes · ' : ''}lang ingedrukt om te bewerken
        </Text>
      )}
    </View>
  )
}

export const RacesBar = memo(RacesBarInner)

// Lege-staat-CTA: schema gekoppeld maar nog geen race gepland.
function AddRaceBar({ theme, onPress }: { theme: Theme; onPress: () => void }) {
  return (
    <View style={styles.outer}>
      <Pressable
        onPress={onPress}
        style={[styles.addCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={[styles.addIcon, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
          <Text style={styles.addIconText}>🏁</Text>
        </View>
        <View style={styles.body}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>Plan een race</Text>
          <Text style={[styles.meta, { color: theme.muted }]}>Krijg een aftelteller bovenaan elk scherm</Text>
        </View>
        <Text style={[styles.addPlus, { color: theme.accent }]}>+</Text>
      </Pressable>
    </View>
  )
}

function WeekBar({ prog, theme }: { prog: WeekProgress; theme: Theme }) {
  const raceHex = ActivityColors.race.text
  return (
    <View style={styles.weekBar}>
      <View style={styles.weekSegRow}>
        {Array.from({ length: prog.total }).map((_, i) => (
          <View key={i} style={[styles.weekSeg, {
            backgroundColor: i < prog.done ? theme.accent
              : i === prog.total - 1 ? raceHex : theme.border,
          }]} />
        ))}
      </View>
      <Text style={[styles.weekLabel, { color: theme.muted }]}>
        week {prog.done} van {prog.total}{prog.taper ? ' · taperfase' : ''}
      </Text>
    </View>
  )
}

function Carousel({ idx, total, go, theme }: {
  idx: number; total: number; go: (d: number) => void; theme: Theme
}) {
  return (
    <View style={styles.carousel}>
      <Arrow dir="prev" disabled={idx === 0} onPress={() => go(-1)} theme={theme} />
      <View style={styles.dots}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={[styles.dot, {
            width: i === idx ? 18 : 6, backgroundColor: i === idx ? theme.accent : theme.border,
          }]} />
        ))}
      </View>
      <Arrow dir="next" disabled={idx === total - 1} onPress={() => go(1)} theme={theme} />
    </View>
  )
}

function Arrow({ dir, disabled, onPress, theme }: {
  dir: 'prev' | 'next'; disabled: boolean; onPress: () => void; theme: Theme
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={[styles.arrow, {
        borderColor: theme.border, backgroundColor: theme.surface, opacity: disabled ? 0.45 : 1,
      }]}
    >
      <Text style={[styles.arrowText, { color: disabled ? theme.border : theme.text }]}>
        {dir === 'prev' ? '‹' : '›'}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  outer:       { marginHorizontal: Spacing.lg, marginBottom: 2 },
  card:        {
    borderRadius: 14, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#0E1F1A', shadowRadius: 22, shadowOffset: { width: 0, height: 8 },
  },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8 },
  tile:        { borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  body:        { flex: 1, minWidth: 0 },
  name:        { fontFamily: Fonts.displaySemiBold, fontSize: 15, letterSpacing: -0.2 },
  meta:        { fontFamily: Fonts.display, fontSize: 12, marginTop: 2 },
  doelRow:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 },
  doelDot:     { width: 6, height: 6, borderRadius: 3 },
  doelText:    { fontFamily: Fonts.mono, fontSize: 11 },
  chevron:     {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignSelf: 'flex-start', marginTop: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  chevronText: { fontFamily: Fonts.display, fontSize: 13, lineHeight: 15 },
  fold:        { paddingHorizontal: 12, paddingBottom: 7 },
  weekBar:     { paddingHorizontal: 4, marginTop: 0 },
  weekSegRow:  { flexDirection: 'row', gap: 3 },
  weekSeg:     { flex: 1, height: 4, borderRadius: 2 },
  weekLabel:   { fontFamily: Fonts.mono, fontSize: 10.5, marginTop: 7 },
  carousel:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  dots:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:         { height: 6, borderRadius: 3 },
  arrow:       { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  arrowText:   { fontFamily: Fonts.display, fontSize: 15, lineHeight: 17 },
  hint:        { fontFamily: Fonts.mono, fontSize: 10, textAlign: 'center', marginTop: 6, letterSpacing: 0.2 },
  addCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1 },
  addIcon:     { width: 40, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  addIconText: { fontSize: 18 },
  addPlus:     { fontFamily: Fonts.displayBold, fontSize: 24, marginRight: 4 },
})
