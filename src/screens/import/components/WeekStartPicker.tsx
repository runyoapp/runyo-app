// runyo — week-start-kiezer voor de import-wizard. Maandkalender (maandag-eerst)
// waarbij elke getikte dag naar de maandag van die week snapt: het schema loopt
// maandag-zondag, dus week 1 begint altijd op een maandag. Geen tekstinvoer →
// geen ongeldige datums mogelijk.

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Fonts } from '@/constants/theme'
import type { Theme } from '@/constants/theme'
import { fromDateString, toDateString, addDays, MONTHS_NL } from '@/utils/date'

const DOW = ['M', 'D', 'W', 'D', 'V', 'Z', 'Z']

function mondayOf(d: Date): Date {
  const dow = (d.getDay() + 6) % 7 // 0=ma … 6=zo
  return addDays(d, -dow)
}

export function WeekStartPicker({
  t, value, onChange,
}: {
  t: Theme; value: string; onChange: (iso: string) => void
}) {
  const sel = fromDateString(value)
  const selMondayISO = isNaN(sel.getTime()) ? '' : toDateString(mondayOf(sel))

  const [view, setView] = useState(() => {
    const base = isNaN(sel.getTime()) ? new Date() : sel
    return { y: base.getFullYear(), m: base.getMonth() }
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
        const weekSelected = toDateString(week[0]) === selMondayISO
        return (
          <TouchableOpacity key={wi} activeOpacity={0.85} onPress={() => onChange(toDateString(week[0]))}
            style={[s.weekRow, weekSelected && { backgroundColor: t.accentGlow, borderColor: t.accent }]}>
            {week.map((d, di) => {
              const other = d.getMonth() !== view.m
              const isMonday = di === 0
              return (
                <View key={di} style={s.cell}>
                  <Text style={[
                    s.dayNum,
                    { color: other ? t.faint : t.text },
                    weekSelected && isMonday && { color: t.accent, fontFamily: Fonts.displayBold },
                  ]}>{d.getDate()}</Text>
                </View>
              )
            })}
          </TouchableOpacity>
        )
      })}
    </View>
  )
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
})
