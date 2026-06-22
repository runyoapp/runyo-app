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

export type IntervalUnit = 'm' | 'km' | 's' | 'min'

// Leidt het ingevoerde bedrag + eenheid terug af uit de canonieke opslag
// (distanceKm/durationMin). Hele waarden tonen we als km/min, fracties als m/s,
// zodat 400 m ↔ 0,4 km en 90 s ↔ 1,5 min netjes terugkomen in de editor.
export function intervalAmountUnit(block: IntervalBlock): { amount: string; unit: IntervalUnit } {
  if (block.durationMin != null) {
    return Number.isInteger(block.durationMin)
      ? { amount: String(block.durationMin), unit: 'min' }
      : { amount: String(Math.round(block.durationMin * 60)), unit: 's' }
  }
  if (block.distanceKm != null) {
    return Number.isInteger(block.distanceKm)
      ? { amount: String(block.distanceKm), unit: 'km' }
      : { amount: String(Math.round(block.distanceKm * 1000)), unit: 'm' }
  }
  return { amount: '', unit: 'm' }
}

export function formatIntervalAmount(block: IntervalBlock): string | null {
  const { amount, unit } = intervalAmountUnit(block)
  return amount ? `${amount} ${unit}` : null
}

// Compacte one-liner voor een intervalblok, bv. "6× 400 m · 3:45/km · 90 s herstel".
export function formatIntervalBlock(block: IntervalBlock): string {
  const amt = formatIntervalAmount(block)
  const head = amt
    ? (block.repeat > 1 ? `${block.repeat}× ${amt}` : amt)
    : (block.repeat > 1 ? `${block.repeat}×` : '')
  const parts = [
    head || null,
    block.pace ? `${block.pace}/km` : null,
    block.recovery ? `${block.recovery} herstel` : null,
  ].filter(Boolean)
  return parts.join(' · ') || `Blok ${block.repeat}×`
}
