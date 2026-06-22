// runyo — review-fase componenten (RN-port van runyo-import-screens-review.jsx).

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { Fonts, ActivityColors } from '@/constants/theme'
import type { Theme } from '@/constants/theme'
import type { ReviewDay, ReviewWeek } from '../reviewModel'
import { MetricPillColors } from '@/components/shared/MetricPills'
import { HintRow } from './atoms'

const WARN = '#B5912B'
const CHECK_BORDER = '#E0A23E'
const CHECK_TXT = '#9A6B16'
const CHECK_BG = 'rgba(255,180,84,0.16)'

function dotColor(type: string): string {
  const c = (ActivityColors as Record<string, { text: string }>)[type]
  return c?.text ?? ActivityColors.run.text
}

// ── Cirkelvormige voortgangsindicator (analyse) ───────────────────────────────
export function Ring({ t, pct, size = 134 }: { t: Theme; pct: number; size?: number }) {
  const sw = 9
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, pct))
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.border} strokeWidth={sw} />
        <Circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={t.accent} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${c * clamped} ${c}`}
          rotation={-90} origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={[s.ringPct, { color: t.text }]}>{Math.round(clamped * 100)}%</Text>
    </View>
  )
}

// ── Dag-rij ───────────────────────────────────────────────────────────────────
export function DayRow({ t, row }: { t: Theme; row: ReviewDay }) {
  const flag = row.needsCheck
  return (
    <View style={[
      s.dayRow,
      { paddingVertical: row.isRest ? 6 : 9 },
      row.isRace && { backgroundColor: 'rgba(200,51,107,0.06)' },
      flag && { backgroundColor: CHECK_BG, borderWidth: 1, borderColor: row.isRace ? t.danger : CHECK_BORDER },
    ]}>
      <Text style={[s.dayLabel, { color: t.muted, opacity: row.isRest ? 0.65 : 1 }]}>{row.label}</Text>
      <View style={[
        s.dot,
        row.isRest
          ? { width: 6, height: 6, borderWidth: 1.5, borderColor: t.border }
          : { width: 8, height: 8, backgroundColor: row.isRace ? t.danger : dotColor(row.type) },
      ]} />
      <Text numberOfLines={1} style={[
        s.dayTitle,
        { color: row.isRest ? t.muted : t.text, fontFamily: row.isRest ? Fonts.displayMedium : Fonts.displaySemiBold, fontSize: row.isRest ? 12.5 : 13.5 },
      ]}>{row.titel}</Text>
      {row.targetPace ? (
        <Text style={[s.metaPill, { color: MetricPillColors.pace.text, backgroundColor: MetricPillColors.pace.bg, borderColor: MetricPillColors.pace.text }]}>{row.targetPace}</Text>
      ) : null}
      {row.targetHr ? (
        <Text style={[s.metaPill, { color: MetricPillColors.hr.text, backgroundColor: MetricPillColors.hr.bg, borderColor: MetricPillColors.hr.text }]}>{row.targetHr} bpm</Text>
      ) : null}
      {row.hasIntervals ? (
        <Text style={[s.metaPill, { color: MetricPillColors.interval.text, backgroundColor: MetricPillColors.interval.bg, borderColor: MetricPillColors.interval.text }]}>interval</Text>
      ) : null}
      {row.isRace && row.goalTime ? (
        <Text style={[s.metaPill, { color: t.danger, borderColor: t.danger }]}>doel {row.goalTime}</Text>
      ) : null}
      {flag ? (
        <View style={[s.checkBadge, { borderColor: row.isRace ? t.danger : CHECK_BORDER }]}>
          <Text style={[s.checkBadgeTxt, { color: row.isRace ? t.danger : CHECK_TXT }]}>check</Text>
        </View>
      ) : null}
      {row.km && row.km > 0 ? (
        <Text style={[s.dayKm, { color: t.text }]}>{row.km}<Text style={{ color: t.muted, fontSize: 10 }}> km</Text></Text>
      ) : null}
    </View>
  )
}

// ── Weekblok (kop + volumebalk + dagen) ───────────────────────────────────────
export function WeekGroup({ t, week, volMax }: { t: Theme; week: ReviewWeek; volMax: number }) {
  const vol = volMax > 0 ? Math.min(1, week.km / volMax) : 0
  return (
    <View style={{ marginTop: 12 }}>
      <View style={[s.weekHeadRow, { paddingTop: 8 }]}>
        <Text style={[s.weekNum, { color: t.text }]}>Week {week.num}</Text>
        <Text style={[s.weekRange, { color: t.muted }]}>{week.range}</Text>
        <View style={s.flex1} />
        <Text style={[s.weekMetric, { color: t.muted }]}>{week.trainingCount} · {week.km} km</Text>
      </View>
      <View style={[s.volTrack, { backgroundColor: t.border }]}>
        <View style={[s.volFill, { backgroundColor: t.accent, width: `${vol * 100}%` }]} />
      </View>
      <View style={[s.weekCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        {week.days.map((row, i) => (
          <View key={row.datum}>
            {i > 0 && !row.needsCheck && !week.days[i - 1].needsCheck ? (
              <View style={[s.hairline, { backgroundColor: t.border }]} />
            ) : null}
            <DayRow t={t} row={row} />
          </View>
        ))}
      </View>
    </View>
  )
}

// ── Inklapbare legenda ────────────────────────────────────────────────────────
export function ReviewLegend({ t }: { t: Theme }) {
  const [open, setOpen] = useState(false)
  const items: [string, string][] = [['run', 'Hardlopen'], ['strength', 'Kracht'], ['race', 'Wedstrijd']]
  return (
    <View style={[s.legend, { backgroundColor: t.surface, borderColor: t.border }]}>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen(o => !o)} style={s.legendHead}>
        <View style={s.legendDots}>
          {['run', 'strength', 'race'].map(k => (
            <View key={k} style={[s.legendDot, { backgroundColor: dotColor(k) }]} />
          ))}
        </View>
        <Text style={[s.legendTitle, { color: t.text }]}>Wat betekenen de kleuren?</Text>
        <Text style={[s.legendChevron, { color: t.muted }]}>{open ? '⌄' : '›'}</Text>
      </TouchableOpacity>
      {open ? (
        <View style={s.legendBody}>
          {items.map(([k, label]) => (
            <View key={k} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: dotColor(k) }]} />
              <Text style={[s.legendLabel, { color: t.text2 }]}>{label}</Text>
            </View>
          ))}
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: t.border }]} />
            <Text style={[s.legendLabel, { color: t.text2 }]}>Rust</Text>
          </View>
          <View style={[s.hairline, { backgroundColor: t.border, marginVertical: 4 }]} />
          <View style={s.legendItem}>
            <View style={[s.checkBadge, { borderColor: CHECK_BORDER, backgroundColor: CHECK_BG }]}>
              <Text style={[s.checkBadgeTxt, { color: CHECK_TXT }]}>check</Text>
            </View>
            <Text style={[s.legendLabel, { color: t.muted }]}>runyo twijfelde hier - controleer deze even.</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}

// ── Samenvatting bovenaan ─────────────────────────────────────────────────────
export function ReviewSummary({
  t, title, weeks, trainings, km, showNudge, onChooseDays,
}: {
  t: Theme; title: string; weeks: number; trainings: number; km: number
  showNudge: boolean; onChooseDays: () => void
}) {
  return (
    <View style={s.summary}>
      <Text style={[s.summaryTitle, { color: t.text }]}>
        {title || 'Je schema'} <Text style={{ color: t.muted, fontFamily: Fonts.displayMedium }}>· {weeks} weken</Text>
      </Text>
      <Text style={[s.summaryMetric, { color: t.muted }]}>{trainings} trainingen · {km} km</Text>
      <View style={{ marginTop: 14 }}>
        <HintRow t={t}>Wil je nog iets aanpassen? Je past je schema straks makkelijk aan in de weekbouwer in de app.</HintRow>
      </View>
      {showNudge ? (
        <View style={[s.nudge]}>
          <View style={[s.nudgeBadge]}><Text style={s.nudgeBadgeTxt}>!</Text></View>
          <View style={s.flex1}>
            <Text style={s.nudgeTitle}>Dit schema had geen vaste weekdagen</Text>
            <Text style={s.nudgeSub}>runyo plaatste de trainingen op volgorde vanaf je startdatum. Wil je liever je eigen dagen kiezen?</Text>
            <TouchableOpacity onPress={onChooseDays} activeOpacity={0.6}>
              <Text style={s.nudgeAction}>← Dagen kiezen</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  hairline: { height: 1, marginHorizontal: 12 },
  ringPct: { fontFamily: Fonts.monoMedium, fontSize: 30, letterSpacing: -0.5 },
  // day row
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: 'transparent' },
  dayLabel: { width: 48, fontFamily: Fonts.mono, fontSize: 11 },
  dot: { borderRadius: 999 },
  dayTitle: { flex: 1, minWidth: 0, letterSpacing: -0.15 },
  checkBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  checkBadgeTxt: { fontFamily: Fonts.mono, fontSize: 9.5 },
  metaPill: { fontFamily: Fonts.mono, fontSize: 9.5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  dayKm: { fontFamily: Fonts.monoMedium, fontSize: 12 },
  // week
  weekHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingBottom: 6 },
  weekNum: { fontFamily: Fonts.displayBold, fontSize: 13.5, letterSpacing: -0.3 },
  weekRange: { fontFamily: Fonts.display, fontSize: 11.5 },
  weekMetric: { fontFamily: Fonts.mono, fontSize: 10.5 },
  volTrack: { height: 3, borderRadius: 999, marginHorizontal: 12, marginBottom: 8, overflow: 'hidden' },
  volFill: { height: '100%', borderRadius: 999 },
  weekCard: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 4, paddingVertical: 3 },
  // legend
  legend: { marginTop: 14, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12 },
  legendDots: { flexDirection: 'row', gap: 4 },
  legendDot: { width: 9, height: 9, borderRadius: 999 },
  legendTitle: { flex: 1, fontFamily: Fonts.displaySemiBold, fontSize: 13, letterSpacing: -0.15 },
  legendChevron: { fontFamily: Fonts.display, fontSize: 15 },
  legendBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  legendLabel: { flex: 1, fontFamily: Fonts.display, fontSize: 12.5 },
  // summary
  summary: { paddingHorizontal: 20, paddingTop: 2 },
  summaryTitle: { fontFamily: Fonts.displayBold, fontSize: 22, letterSpacing: -0.6, lineHeight: 24 },
  summaryMetric: { fontFamily: Fonts.mono, fontSize: 12, marginTop: 8 },
  // nudge
  nudge: { marginTop: 16, flexDirection: 'row', gap: 11, alignItems: 'flex-start', backgroundColor: 'rgba(181,145,43,0.10)', borderRadius: 12, padding: 13 },
  nudgeBadge: { width: 17, height: 17, borderRadius: 999, borderWidth: 1.5, borderColor: WARN, marginTop: 1, alignItems: 'center', justifyContent: 'center' },
  nudgeBadgeTxt: { fontFamily: Fonts.displayBold, fontSize: 11, color: WARN },
  nudgeTitle: { fontFamily: Fonts.displaySemiBold, fontSize: 13, color: '#7A6320', letterSpacing: -0.15 },
  nudgeSub: { fontFamily: Fonts.display, fontSize: 12.5, color: '#8A7330', marginTop: 3, lineHeight: 17 },
  nudgeAction: { fontFamily: Fonts.displaySemiBold, fontSize: 12.5, color: '#7A6320', marginTop: 9 },
})
