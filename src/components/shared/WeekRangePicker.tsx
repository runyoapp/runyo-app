// runyo — week-range-kiezer: een maandkalender (maandag-eerst) waarin je de
// begin- én eindweek van een plan selecteert. Eerste tik = beginweek; tweede tik
// (≥ begin) = eindweek; een nieuwe tik vóór de begin-week of met beide gezet
// herstart de selectie. Output: startDate (maandag van de beginweek) + weekCount
// (inclusief aantal weken). Zelfde maandag-verankering als WeekStartPicker.

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Fonts } from '@/constants/theme'
import type { Theme } from '@/constants/theme'
import { fromDateString, toDateString, addDays, MONTHS_NL, DAYS_NL } from '@/utils/date'

// 2-letterige dag-labels (Ma Di Wo Do Vr Za Zo) — 1-letterig maakt di/do en za/zo gelijk.
const DOW = DAYS_NL

function mondayOf(d: Date): Date {
  const dow = (d.getDay() + 6) % 7 // 0=ma … 6=zo
  return addDays(d, -dow)
}

// Inclusief aantal weken tussen twee maandagen (≥ 1). Dagverschil afgerond i.v.m. DST.
function weekCountBetween(startMonISO: string, endMonISO: string): number {
  const a = fromDateString(startMonISO).getTime()
  const b = fromDateString(endMonISO).getTime()
  const days = Math.round((b - a) / 86400000)
  return Math.max(1, Math.floor(days / 7) + 1)
}

export function WeekRangePicker({
  t, startDate, weekCount, onChange,
}: {
  t: Theme
  startDate: string            // maandag-ISO van de beginweek
  weekCount: number            // inclusief aantal weken
  onChange: (startDate: string, weekCount: number) => void
}) {
  const startMon = toDateString(mondayOf(fromDateString(startDate)))
  const endMon   = toDateString(addDays(fromDateString(startMon), (Math.max(1, weekCount) - 1) * 7))

  // pendingStart != null → wachten op de tweede tik (de eindweek).
  const [pendingStart, setPendingStart] = useState<string | null>(null)

  const [view, setView] = useState(() => {
    const base = fromDateString(startDate)
    const d = isNaN(base.getTime()) ? new Date() : base
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const first = new Date(view.y, view.m, 1)
  const startPad = (first.getDay() + 6) % 7 // maandag-eerst
  const gridStart = addDays(first, -startPad)
  const weeks: Date[][] = []
  for (let w = 0; w < 6; w++) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(gridStart, w * 7 + i)))
  }

  const shiftMonth = (delta: number) => {
    setView(v => {
      const d = new Date(v.y, v.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const onWeekPress = (weekMonISO: string) => {
    if (pendingStart === null) {
      // Eerste tik: kies de beginweek, wacht op de eindweek.
      setPendingStart(weekMonISO)
      return
    }
    if (weekMonISO < pendingStart) {
      // Tik vóór de begin → herstart met deze als nieuwe begin.
      setPendingStart(weekMonISO)
      return
    }
    onChange(pendingStart, weekCountBetween(pendingStart, weekMonISO))
    setPendingStart(null)
  }

  // Effectieve highlight-grenzen: tijdens een lopende selectie alleen de begin-week,
  // anders het opgeslagen bereik.
  const loStart = pendingStart ?? startMon
  const loEnd   = pendingStart ?? endMon

  const rangeLabel = pendingStart
    ? 'Kies de eindweek'
    : `${weekCount} ${weekCount === 1 ? 'week' : 'weken'} · ${fmt(startMon)} – ${fmt(toDateString(addDays(fromDateString(endMon), 6)))}`

  return (
    <View>
      <View style={s.head}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={10} activeOpacity={0.6}
          style={[s.navBtn, { borderColor: t.border, backgroundColor: t.surface }]}>
          <Text style={[s.navChevron, { color: t.text }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[s.monthLabel, { color: t.text }]}>{MONTHS_NL[view.m]} {view.y}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={10} activeOpacity={0.6}
          style={[s.navBtn, { borderColor: t.border, backgroundColor: t.surface }]}>
          <Text style={[s.navChevron, { color: t.text }]}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={s.dowRow}>
        {DOW.map((d, i) => <Text key={i} style={[s.dowLabel, { color: t.muted }]}>{d}</Text>)}
      </View>

      {weeks.map((week, wi) => {
        const weekMon = toDateString(week[0])
        const inRange = weekMon >= loStart && weekMon <= loEnd
        const isStart = weekMon === loStart
        const isEnd   = weekMon === loEnd
        return (
          <TouchableOpacity key={wi} activeOpacity={0.85} onPress={() => onWeekPress(weekMon)}
            style={[
              s.weekRow,
              inRange && { backgroundColor: t.accentGlow, borderColor: t.accent },
            ]}>
            {week.map((d, di) => {
              const other = d.getMonth() !== view.m
              const edge = (isStart && di === 0) || (isEnd && di === 6)
              return (
                <View key={di} style={s.cell}>
                  <Text style={[
                    s.dayNum,
                    { color: other ? t.faint : t.text },
                    inRange && edge && { color: t.accent, fontFamily: Fonts.displayBold },
                  ]}>{d.getDate()}</Text>
                </View>
              )
            })}
          </TouchableOpacity>
        )
      })}

      <Text style={[s.summary, { color: pendingStart ? t.accent : t.muted }]}>{rangeLabel}</Text>
    </View>
  )
}

function fmt(iso: string): string {
  const d = fromDateString(iso)
  return `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  navChevron: { fontFamily: Fonts.displayMedium, fontSize: 19, marginTop: -2 },
  monthLabel: { fontFamily: Fonts.displaySemiBold, fontSize: 15.5, letterSpacing: -0.2 },
  dowRow: { flexDirection: 'row', marginBottom: 4 },
  dowLabel: { flex: 1, textAlign: 'center', fontFamily: Fonts.mono, fontSize: 10.5 },
  weekRow: { flexDirection: 'row', borderWidth: 1, borderColor: 'transparent', borderRadius: 10, paddingVertical: 2, marginBottom: 2 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontFamily: Fonts.displayMedium, fontSize: 13.5 },
  summary: { fontFamily: Fonts.mono, fontSize: 11.5, textAlign: 'center', marginTop: 10 },
})
