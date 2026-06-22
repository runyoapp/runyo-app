// runyo — één bron van waarheid voor het afleiden van pace/HR/duur/intervallen
// uit een activiteit. Struct-first: de gestructureerde weekbouwer-velden
// (targetPace/targetHr/intervals) hebben voorrang; ontbreken ze, dan valt het
// terug op slimme detail-parsing zodat oudere/tekst-only imports die pace/HR
// alleen in `detail` hebben het nog steeds tonen.
//
// Duck-typed op de velden zodat zowel `Activity` als de wizard-`ParsedRow` dit
// kunnen voeden — vandaar het losse MetricSource-type i.p.v. een vaste Activity.

import type { IntervalBlock } from '@/types/activity'

type MetricSource = {
  targetPace?: string | null
  targetHr?: number | null
  intervals?: IntervalBlock[] | null
  detail?: string | null
}

export type ActivityMetrics = {
  pace: string | null
  hr: string | null
  duur: string | null
  hasIntervals: boolean
  intervals: IntervalBlock[] | null
}

export function deriveActivityMetrics(a: MetricSource): ActivityMetrics {
  const detail    = a.detail ?? ''
  const paceMatch = detail.match(/(\d+:\d+)[–-]?(\d+:\d+)?\/km/)
  const hrMatch   = detail.match(/<?\s*(\d+)\s*bpm/i) ?? detail.match(/HR\s*<?(\d+)/i)
  const duurMatch = detail.match(/(\d+)\s*(?:min|')/i)

  const pace = a.targetPace
    ? (/km/i.test(a.targetPace) ? a.targetPace : `${a.targetPace}/km`)
    : (paceMatch ? paceMatch[0].replace('/km', '').trim() + '/km' : null)
  const hr = a.targetHr != null
    ? `${a.targetHr} bpm`
    : (hrMatch ? `${hrMatch[1]} bpm` : null)
  const duur = duurMatch ? `${duurMatch[1]}′` : null

  const intervals = a.intervals && a.intervals.length > 0 ? a.intervals : null
  return { pace, hr, duur, hasIntervals: intervals != null, intervals }
}

// Compacte one-liner voor een intervalblok — gespiegeld op de editor-opbouw
// (EditorScreen.tsx blockTitle + blockMeta), bv. "Tempo-blok · 5× · 1 km · 3:50/km · 90s herstel".
export function formatIntervalBlock(block: IntervalBlock): string {
  const parts: string[] = []
  if (block.label) parts.push(block.label)
  if (block.repeat > 1) parts.push(`${block.repeat}×`)
  if (block.distanceKm != null) parts.push(`${block.distanceKm} km`)
  else if (block.durationMin != null) parts.push(`${block.durationMin} min`)
  if (block.pace) parts.push(`${block.pace}/km`)
  if (block.recovery) parts.push(`${block.recovery} herstel`)
  return parts.join(' · ') || `Blok ${block.repeat}×`
}
