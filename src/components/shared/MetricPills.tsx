// runyo — gedeelde read-only weergave voor afgeleide activiteit-metrics.
// MetricPills = subtiele pace/hr/"intervallen"-pills (visueel gespiegeld op de
// metaPill uit de import-review). IntervalBlocks = nette read-only regels per
// intervalblok voor het detail-modal. Beide putten uit deriveActivityMetrics,
// zodat alle surfaces dezelfde bron tonen.

import { View, Text, StyleSheet } from 'react-native'
import { Fonts } from '@/constants/theme'
import type { Theme } from '@/constants/theme'
import type { IntervalBlock } from '@/types/activity'
import { formatIntervalBlock } from '@/utils/activityMetrics'

// Vaste kleur per metric-type — pace = mint (run), hartslag = magenta (hart),
// interval = paars. Gespiegeld in de import-review zodat beide surfaces gelijk
// kleuren. Translucente vulling + verzadigde tekst/rand, leesbaar in light & dark.
export type MetricPillKind = 'pace' | 'hr' | 'interval'
export const MetricPillColors: Record<MetricPillKind, { text: string; bg: string }> = {
  pace:     { text: '#00B98E', bg: 'rgba(0,185,142,0.12)' },
  hr:       { text: '#C8336B', bg: 'rgba(200,51,107,0.12)' },
  interval: { text: '#8E5BD6', bg: 'rgba(142,91,214,0.12)' },
}

export function MetricPills({ pace, hr, hasIntervals }: {
  pace?: string | null
  hr?: string | null
  hasIntervals?: boolean
}) {
  const pills: { kind: MetricPillKind; text: string }[] = []
  if (pace) pills.push({ kind: 'pace', text: pace })
  if (hr) pills.push({ kind: 'hr', text: hr })
  if (hasIntervals) pills.push({ kind: 'interval', text: 'interval' })
  if (pills.length === 0) return null
  return (
    <View style={styles.row}>
      {pills.map((p, i) => {
        const c = MetricPillColors[p.kind]
        return <Text key={i} style={[styles.pill, { color: c.text, backgroundColor: c.bg, borderColor: c.text }]}>{p.text}</Text>
      })}
    </View>
  )
}

export function IntervalBlocks({ theme, intervals }: { theme: Theme; intervals: IntervalBlock[] }) {
  if (intervals.length === 0) return null
  return (
    <View style={styles.blocks}>
      {intervals.map(b => (
        <View key={b.id} style={[styles.block, { borderColor: theme.border, backgroundColor: theme.surface2 }]}>
          <Text style={[styles.blockText, { color: theme.text2 }]}>{formatIntervalBlock(b)}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill:      { fontFamily: Fonts.mono, fontSize: 9.5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  blocks:    { gap: 6 },
  block:     { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  blockText: { fontFamily: Fonts.mono, fontSize: 11.5, lineHeight: 16 },
})
