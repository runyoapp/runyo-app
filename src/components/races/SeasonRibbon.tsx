import { useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Fonts, Radius, type Theme } from '@/constants/theme'
import { fromDateString, MONTHS_NL } from '@/utils/date'
import type { Activity } from '@/types/activity'

type Marker = {
  id: string
  x: number         // pixel-positie langs de track
  tier: 'A' | 'B'
  isNext: boolean
  isPast: boolean
}

type Props = {
  races: Activity[]      // alle races (verleden + toekomst), oplopend op datum
  nextId: string | null  // id van de eerstvolgende toekomstige race (of null)
}

// Hoeveel maanden ongeveer tegelijk in beeld passen; bepaalt de maandbreedte.
const VISIBLE_MONTHS = 4.5

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

// Horizontaal slidebare seizoens-tijdlijn over het hele kalenderjaar (jan t/m dec)
// van de eerstvolgende race. ~4,5 maanden in beeld; opent gecentreerd op vandaag.
// Race-vlaggen + "nu"-stip staan op tijd-evenredige pixelposities; je sleept door
// het jaar door horizontaal te scrollen.
export function SeasonRibbon({ races, nextId }: Props) {
  const theme = useTheme()
  const [width, setWidth] = useState(0)
  const scrollRef  = useRef<ScrollView>(null)
  const centeredRef = useRef(false)

  const todayStr = new Date().toISOString().split('T')[0]
  // Anker-jaar = jaar van de eerstvolgende race; zonder toekomstige race het jaar
  // van de meest recente (laatste) race, zodat de tijdlijn op de juiste plek staat.
  const anchor = races.find(r => r.id === nextId) ?? races[races.length - 1]
  const year = fromDateString(anchor.datum).getFullYear()

  // Pixelpositie van een datum: (maand-index + fractie binnen de maand) * maandbreedte.
  // Zo vallen vlaggen exact uitgelijnd met de maandkolommen, ook al verschillen de
  // maandlengtes. Datums vóór/na het jaar klemmen aan de randen.
  const monthW  = width > 0 ? width / VISIBLE_MONTHS : 0
  const trackW  = monthW * 12

  const xOfDate = (d: Date): number => {
    if (d.getFullYear() < year) return 0
    if (d.getFullYear() > year) return trackW
    const mi   = d.getMonth()
    const frac = (d.getDate() - 1) / daysInMonth(year, mi)
    return (mi + frac) * monthW
  }

  const now    = new Date()
  const nowX   = xOfDate(now)
  const initX  = Math.max(0, Math.min(trackW - width, nowX - width / 2))

  const markers: Marker[] = races.map(r => ({
    id: r.id,
    x: xOfDate(fromDateString(r.datum)),
    tier: r.isMainGoal ? 'A' : 'B',
    isNext: r.id === nextId,
    isPast: r.datum < todayStr,
  }))

  return (
    <View
      style={[styles.wrap, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onLayout={e => {
        const w = e.nativeEvent.layout.width
        if (w !== width) { centeredRef.current = false; setWidth(w) }
      }}
    >
      {width > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ width: trackW }}
          // contentOffset wordt op web genegeerd → centreer expliciet op vandaag
          // zodra de content gemeten is (één keer, daarna mag de gebruiker vrij sliden).
          onContentSizeChange={() => {
            if (!centeredRef.current) {
              scrollRef.current?.scrollTo({ x: initX, animated: false })
              centeredRef.current = true
            }
          }}
        >
          <View style={{ width: trackW, flex: 1 }}>
            {/* Maandkolommen met label (geen scheidingslijntjes) */}
            <View style={styles.monthRow}>
              {MONTHS_NL.map((m, i) => (
                <View key={i} style={[styles.monthCell, { width: monthW }]}>
                  <Text style={[styles.month, { color: theme.muted }]} numberOfLines={1}>{m}</Text>
                </View>
              ))}
            </View>

            {/* As + verstreken-deel */}
            <View style={[styles.axis, { backgroundColor: theme.border }]} />
            <View style={[styles.axisDone, { backgroundColor: theme.accent, width: nowX }]} />

            {/* "nu"-stip */}
            <View style={[styles.dotWrap, { left: nowX }]}>
              <View style={[styles.dot, { backgroundColor: theme.accent, borderColor: theme.surface }]} />
            </View>

            {/* Race-vlaggen */}
            {markers.map(mk => (
              <Flag key={mk.id} marker={mk} theme={theme} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

function Flag({ marker, theme }: { marker: Marker; theme: Theme }) {
  const size = marker.isNext ? 26 : 22
  const isA  = marker.tier === 'A'

  // Verleden race = gedempt/voltooid: grijze vlag met vinkje, halftransparant.
  if (marker.isPast) {
    return (
      <View style={[styles.flagWrap, { left: marker.x, opacity: 0.55 }]}>
        <View
          style={[
            styles.flag,
            { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.surface2, borderWidth: 1.5, borderColor: theme.faint },
          ]}
        >
          <Text style={{ fontFamily: Fonts.displayBold, fontSize: 11, color: theme.muted }}>✓</Text>
        </View>
        <View style={[styles.stem, { backgroundColor: theme.border }]} />
      </View>
    )
  }

  return (
    <View style={[styles.flagWrap, { left: marker.x }]}>
      <View
        style={[
          styles.flag,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: isA ? theme.accent : theme.surface2,
            borderWidth: isA ? 0 : 1.5,
            borderColor: theme.text,
          },
        ]}
      >
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: marker.isNext ? 12 : 10,
            color: isA ? '#fff' : theme.accent,
          }}
        >
          {marker.tier}
        </Text>
      </View>
      <View style={[styles.stem, { backgroundColor: isA ? theme.accent : theme.border }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap:      { height: 92, borderRadius: Radius.lg + 2, borderWidth: 1, overflow: 'hidden' },
  axis:      { position: 'absolute', left: 0, right: 0, top: 54, height: 3, borderRadius: 999 },
  axisDone:  { position: 'absolute', left: 0, top: 54, height: 3, borderRadius: 999 },
  monthRow:  { position: 'absolute', left: 0, right: 0, top: 60, bottom: 0, flexDirection: 'row' },
  monthCell: { alignItems: 'center', paddingTop: 4 },
  month:     { fontFamily: Fonts.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  dotWrap:   { position: 'absolute', top: 49 },
  dot:       { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginLeft: -5 },
  flagWrap:  { position: 'absolute', top: 12, alignItems: 'center', marginLeft: -13 },
  flag:      { alignItems: 'center', justifyContent: 'center' },
  stem:      { width: 2, height: 14 },
})
