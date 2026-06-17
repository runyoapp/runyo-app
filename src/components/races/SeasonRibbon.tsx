import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Fonts, Radius, type Theme } from '@/constants/theme'
import { fromDateString, MONTHS_NL } from '@/utils/date'
import type { Activity } from '@/types/activity'

type Marker = {
  id: string
  pos: number       // 0..1 langs de tijd-as
  tier: 'A' | 'B'
  isNext: boolean
}

type Props = {
  races: Activity[]
}

const PAD = 16

// Volledig kalenderjaar (jan t/m dec) van de eerstvolgende race als tijd-as.
// "nu"-stip + race-vlaggen op tijd-evenredige posities binnen dat jaar. Alle
// x-posities leven in een track-laag die links en rechts met PAD is ingesprongen,
// zodat pos 0..1 exact tussen de randen valt.
export function SeasonRibbon({ races }: Props) {
  const theme = useTheme()

  const year    = fromDateString(races[0].datum).getFullYear()
  const startMs = new Date(year, 0, 1).getTime()
  const endMs   = new Date(year, 11, 31, 23, 59, 59, 999).getTime()
  const span    = Math.max(endMs - startMs, 1)

  const posOf  = (ms: number) => Math.min(1, Math.max(0, (ms - startMs) / span))
  const nowPos = posOf(Date.now())

  const markers: Marker[] = races.map(r => ({
    id: r.id,
    pos: posOf(fromDateString(r.datum).getTime()),
    tier: r.isMainGoal ? 'A' : 'B',
    isNext: r.id === races[0].id,
  }))

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.track}>
        {/* As + verstreken-deel */}
        <View style={[styles.axis, { backgroundColor: theme.border }]} />
        <View style={[styles.axisDone, { backgroundColor: theme.accent, width: pct(nowPos) }]} />

        {/* Maandlabels — alle 12 maanden als gelijke kolommen */}
        <View style={styles.monthRow}>
          {MONTHS_NL.map((m, i) => (
            <View key={i} style={styles.monthCell}>
              <Text style={[styles.month, { color: theme.muted }]} numberOfLines={1}>{m}</Text>
            </View>
          ))}
        </View>

        {/* "nu"-stip */}
        <View style={[styles.dotWrap, { left: pct(nowPos) }]}>
          <View style={[styles.dot, { backgroundColor: theme.accent, borderColor: theme.surface }]} />
        </View>

        {/* Race-vlaggen */}
        {markers.map(mk => (
          <Flag key={mk.id} marker={mk} theme={theme} />
        ))}
      </View>
    </View>
  )
}

function Flag({ marker, theme }: { marker: Marker; theme: Theme }) {
  const size = marker.isNext ? 26 : 22
  const isA  = marker.tier === 'A'
  return (
    <View style={[styles.flagWrap, { left: pct(marker.pos) }]}>
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

function pct(pos: number): `${number}%` {
  return `${pos * 100}%`
}

const styles = StyleSheet.create({
  wrap:      { height: 92, borderRadius: Radius.lg + 2, borderWidth: 1, overflow: 'hidden' },
  track:     { flex: 1, marginHorizontal: PAD },
  axis:      { position: 'absolute', left: 0, right: 0, top: 54, height: 3, borderRadius: 999 },
  axisDone:  { position: 'absolute', left: 0, top: 54, height: 3, borderRadius: 999 },
  monthRow:  { position: 'absolute', left: 0, right: 0, top: 64, flexDirection: 'row' },
  monthCell: { flex: 1, alignItems: 'center' },
  month:     { fontFamily: Fonts.mono, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.2 },
  dotWrap:   { position: 'absolute', top: 49 },
  dot:       { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginLeft: -5 },
  flagWrap:  { position: 'absolute', top: 12, alignItems: 'center', marginLeft: -13 },
  flag:      { alignItems: 'center', justifyContent: 'center' },
  stem:      { width: 2, height: 14 },
})
