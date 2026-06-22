// runyo — uitklapbaar voorbeeldschema op de bron-stap van de import-wizard.
// Laat een nieuwe gebruiker vóór het uploaden zien wat runyo eruit haalt:
// niet alleen afstand, maar ook tempo, hartslag en intervalblokken. Spiegelt
// de visuele taal van het review-weekblok (DayRow/WeekGroup) zodat het voelt
// als een echte preview van het resultaat, niet als losse uitleg.

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Fonts, ActivityColors } from '@/constants/theme'
import type { Theme } from '@/constants/theme'

type Row = {
  label: string
  type: 'run' | 'rest'
  titel: string
  pace?: string
  hr?: string
  intervals?: string
  km?: number
}

// Eén voorbeeldweek met variatie: rust, rustige duurloop (tempo), interval
// (blokken + tempo), tempoloop (tempo + hartslag), lange duurloop.
const EXAMPLE: Row[] = [
  { label: 'ma', type: 'rest', titel: 'Rust' },
  { label: 'di', type: 'run',  titel: 'Rustige duurloop', pace: '5:30', km: 8 },
  { label: 'wo', type: 'run',  titel: 'Intervaltraining', intervals: '6×800m', pace: '3:45', km: 10 },
  { label: 'vr', type: 'run',  titel: 'Tempoloop', pace: '4:20', hr: '165 bpm', km: 6 },
  { label: 'za', type: 'run',  titel: 'Lange duurloop', pace: '5:45', km: 18 },
]

function dotColor(type: string): string {
  const c = (ActivityColors as Record<string, { text: string }>)[type]
  return c?.text ?? ActivityColors.run.text
}

export function SchemaExample({ t }: { t: Theme }) {
  const [open, setOpen] = useState(false)
  return (
    <View>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen(o => !o)} style={s.toggle}>
        <Text style={[s.toggleTxt, { color: t.text2 }]}>Wat voor schema werkt?</Text>
        <Text style={[s.chevron, { color: t.muted }]}>{open ? '⌄' : '›'}</Text>
      </TouchableOpacity>
      {open ? (
        <View style={s.body}>
          <Text style={[s.intro, { color: t.muted }]}>
            runyo leest niet alleen je afstanden, maar ook je tempo, hartslag en intervallen - en deelt alles in weken in. Dit komt er bijvoorbeeld uit:
          </Text>
          <View style={[s.weekCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={s.weekHead}>
              <Text style={[s.weekNum, { color: t.text }]}>Week 1</Text>
              <Text style={[s.weekMetric, { color: t.muted }]}>4 trainingen · 42 km</Text>
            </View>
            {EXAMPLE.map((row, i) => {
              const isRest = row.type === 'rest'
              return (
                <View key={row.label}>
                  {i > 0 ? <View style={[s.hairline, { backgroundColor: t.border }]} /> : null}
                  <View style={[s.dayRow, { paddingVertical: isRest ? 6 : 9 }]}>
                    <Text style={[s.dayLabel, { color: t.muted, opacity: isRest ? 0.65 : 1 }]}>{row.label}</Text>
                    <View style={[
                      s.dot,
                      isRest
                        ? { width: 6, height: 6, borderWidth: 1.5, borderColor: t.border }
                        : { width: 8, height: 8, backgroundColor: dotColor(row.type) },
                    ]} />
                    <Text numberOfLines={1} style={[
                      s.dayTitle,
                      { color: isRest ? t.muted : t.text, fontFamily: isRest ? Fonts.displayMedium : Fonts.displaySemiBold, fontSize: isRest ? 12.5 : 13.5 },
                    ]}>{row.titel}</Text>
                    {row.intervals ? <Text style={[s.pill, { color: t.muted, borderColor: t.border }]}>{row.intervals}</Text> : null}
                    {row.pace ? <Text style={[s.pill, { color: t.muted, borderColor: t.border }]}>{row.pace}</Text> : null}
                    {row.hr ? <Text style={[s.pill, { color: t.muted, borderColor: t.border }]}>{row.hr}</Text> : null}
                    {row.km ? <Text style={[s.dayKm, { color: t.text }]}>{row.km}<Text style={{ color: t.muted, fontSize: 10 }}> km</Text></Text> : null}
                  </View>
                </View>
              )
            })}
          </View>
          <Text style={[s.note, { color: t.muted }]}>
            Weeknummers of datums, en per dag een afstand of duur. Een PDF, spreadsheet of duidelijke foto werkt - runyo snapt ook losse "dag 1, dag 2"-schema's.
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleTxt: { fontFamily: Fonts.displaySemiBold, fontSize: 13 },
  chevron: { fontFamily: Fonts.display, fontSize: 15 },
  body: { marginTop: 11, gap: 11 },
  intro: { fontFamily: Fonts.display, fontSize: 12.5, lineHeight: 18 },
  note: { fontFamily: Fonts.display, fontSize: 12, lineHeight: 17 },
  hairline: { height: 1, marginHorizontal: 12 },
  weekCard: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 4, paddingVertical: 3 },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 9, paddingBottom: 6 },
  weekNum: { fontFamily: Fonts.displayBold, fontSize: 13.5, letterSpacing: -0.3 },
  weekMetric: { fontFamily: Fonts.mono, fontSize: 10.5 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12 },
  dayLabel: { width: 28, fontFamily: Fonts.mono, fontSize: 11 },
  dot: { borderRadius: 999 },
  dayTitle: { flex: 1, minWidth: 0, letterSpacing: -0.15 },
  pill: { fontFamily: Fonts.mono, fontSize: 9.5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  dayKm: { fontFamily: Fonts.monoMedium, fontSize: 12 },
})
