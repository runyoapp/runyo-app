// runyo — losse-dag datumpicker. Vriendelijke datumrij die uitklapt naar een
// maandkalender (maandag-eerst) waarin je elke dag kunt aantikken. Geen tekstinvoer
// → geen ongeldige datums. Voor o.a. de race-datum in de weekbouwer/RaceModal.

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Fonts, Radius, type Theme } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { fromDateString, toDateString, addDays, DAYS_NL, MONTHS_NL, MONTHS_FULL_NL } from '@/utils/date'

// 2-letterige dag-labels (Ma Di Wo Do Vr Za Zo) — anders zijn di/do en za/zo niet
// te onderscheiden (beide "D" / "Z").
const DOW = DAYS_NL

function fmtFriendly(iso: string): string {
  const d = fromDateString(iso)
  if (isNaN(d.getTime())) return iso
  return `${DAYS_NL[(d.getDay() + 6) % 7].toLowerCase()} ${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${d.getFullYear()}`
}

export function DayPicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const t = useTheme()
  const [open, setOpen] = useState(false)

  const sel    = fromDateString(value)
  const selISO = isNaN(sel.getTime()) ? '' : toDateString(sel)
  const todayISO = toDateString(new Date())
  const day = isNaN(sel.getTime()) ? '' : String(sel.getDate())

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setOpen(o => !o)}
        style={[s.dateRow, { backgroundColor: t.surface, borderColor: open ? t.accent : t.border }]}
      >
        <View style={[s.dateIcon, { borderColor: t.border }]}>
          <View style={[s.dateIconTop, { backgroundColor: t.text }]} />
          <View style={s.dateIconBody}>
            <Text style={[s.dateIconDay, { color: t.text }]}>{day}</Text>
          </View>
        </View>
        <Text style={[s.dateText, { color: t.text }]}>{fmtFriendly(value)}</Text>
        <Text style={[s.dateChevron, { color: t.muted }]}>{open ? '⌄' : '›'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={[s.calendar, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Calendar
            t={t}
            selISO={selISO}
            todayISO={todayISO}
            base={isNaN(sel.getTime()) ? new Date() : sel}
            onPick={iso => { onChange(iso); setOpen(false) }}
          />
        </View>
      )}
    </View>
  )
}

export function Calendar({
  t, selISO, todayISO, base, onPick,
}: {
  t: Theme; selISO: string; todayISO: string; base: Date; onPick: (iso: string) => void
}) {
  const [view, setView] = useState(() => ({ y: base.getFullYear(), m: base.getMonth() }))

  const first = new Date(view.y, view.m, 1)
  const startPad = (first.getDay() + 6) % 7 // maandag-eerst
  const gridStart = addDays(first, -startPad)
  const weeks: Date[][] = []
  for (let w = 0; w < 6; w++) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(gridStart, w * 7 + i)))
  }

  const shiftMonth = (delta: number) =>
    setView(v => {
      const d = new Date(v.y, v.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  return (
    <View>
      <View style={s.head}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={10} activeOpacity={0.6}
          style={[s.navBtn, { borderColor: t.border, backgroundColor: t.surface }]}>
          <Text style={[s.navChevron, { color: t.text }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[s.monthLabel, { color: t.text }]}>{MONTHS_FULL_NL[view.m]} {view.y}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={10} activeOpacity={0.6}
          style={[s.navBtn, { borderColor: t.border, backgroundColor: t.surface }]}>
          <Text style={[s.navChevron, { color: t.text }]}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={s.dowRow}>
        {DOW.map((d, i) => <Text key={i} style={[s.dowLabel, { color: t.muted }]}>{d}</Text>)}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={s.weekRow}>
          {week.map((d, di) => {
            const iso      = toDateString(d)
            const other    = d.getMonth() !== view.m
            const selected = iso === selISO
            const isToday  = iso === todayISO
            return (
              <TouchableOpacity key={di} activeOpacity={0.7} onPress={() => onPick(iso)} style={s.cell}>
                <View style={[s.cellInner, selected && { backgroundColor: t.accent }]}>
                  <Text style={[
                    s.dayNum,
                    { color: other ? t.faint : t.text },
                    isToday && !selected && { color: t.accent, fontFamily: Fonts.displayBold },
                    selected && { color: t.accentInk, fontFamily: Fonts.displayBold },
                  ]}>{d.getDate()}</Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderRadius: Radius.md },
  dateIcon:    { width: 30, height: 30, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  dateIconTop: { height: 8 },
  dateIconBody:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  dateIconDay: { fontFamily: Fonts.displayBold, fontSize: 12, lineHeight: 14 },
  dateText:    { flex: 1, fontFamily: Fonts.displaySemiBold, fontSize: 15, letterSpacing: -0.15 },
  dateChevron: { fontFamily: Fonts.display, fontSize: 18 },

  calendar:    { marginTop: 8, borderWidth: 1, borderRadius: Radius.md, padding: 12 },
  head:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn:      { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  navChevron:  { fontFamily: Fonts.displayMedium, fontSize: 19, marginTop: -2 },
  monthLabel:  { fontFamily: Fonts.displaySemiBold, fontSize: 15, letterSpacing: -0.2, textTransform: 'capitalize' },
  dowRow:      { flexDirection: 'row', marginBottom: 4 },
  dowLabel:    { flex: 1, textAlign: 'center', fontFamily: Fonts.mono, fontSize: 10.5 },
  weekRow:     { flexDirection: 'row' },
  cell:        { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  cellInner:   { width: '100%', aspectRatio: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dayNum:      { fontFamily: Fonts.displayMedium, fontSize: 13.5 },
})
