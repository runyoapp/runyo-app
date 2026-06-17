import { useState, useEffect } from 'react'
import { View, Text, TextInput, StyleSheet } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { ModalSheet } from '@/components/shared/ModalSheet'
import {
  FieldLabel, ChipSelect, DistanceStepper, EditorTextField,
  EditorTextArea, Toggle, SaveBar, type ChipOption,
} from '@/components/shared/editor'
import { DayPicker } from '@/components/shared/DayPicker'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { createActivity, patchActivity } from '@/services/activities'
import { ActivityColors, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { fromDateString } from '@/utils/date'
import type { Activity } from '@/types/activity'

type Props = {
  activity: Activity | null   // null = new race
  prefillDate?: string
  visible: boolean
  onClose: () => void
}

const RACE_DIST: { key: string; label: string; km: number | null }[] = [
  { key: '5',    label: '5 km',     km: 5 },
  { key: '10',   label: '10 km',    km: 10 },
  { key: '10mi', label: '10 mile',  km: 16.09 },
  { key: 'hm',   label: 'Halve',    km: 21.0975 },
  { key: 'm',    label: 'Marathon', km: 42.195 },
  { key: 'other',label: 'Anders',   km: null },
]
const RACE_TYPES = ['Weg', 'Baan', 'Trail', 'Ultra', 'Virtueel']

const today = new Date().toISOString().split('T')[0]
function daysUntil(iso: string): number {
  const d = fromDateString(iso)
  const now = fromDateString(today)
  if (isNaN(d.getTime())) return 0
  return Math.round((d.getTime() - now.getTime()) / 86400000)
}

function matchDist(km: number | null): string {
  if (km == null) return '5'
  const hit = RACE_DIST.find(d => d.km != null && Math.abs(d.km - km) < 0.05)
  return hit ? hit.key : 'other'
}

function paceStr(totalSec: number, km: number | null): string {
  if (!km || km <= 0 || !totalSec) return '—'
  const per = totalSec / km
  const m = Math.floor(per / 60)
  const sec = Math.round(per % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

// Parse "h:mm:ss" / "mm:ss" → segments
function parseGoal(goal: string): { h: string; m: string; s: string } {
  const parts = (goal || '').split(':').map(x => x.trim())
  if (parts.length === 3) return { h: parts[0], m: parts[1], s: parts[2] }
  if (parts.length === 2) return { h: '0', m: parts[0], s: parts[1] }
  return { h: '0', m: '', s: '' }
}

export function RaceModal({ activity, prefillDate, visible, onClose }: Props) {
  const t              = useTheme()
  const queryClient    = useQueryClient()
  const schemaId       = useDataStore(s => s.schemaId)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const showToast      = useUiStore(s => s.showToast)

  const isEdit   = !!activity
  const raceHex  = ActivityColors.race.text

  const [name,       setName]       = useState('')
  const [date,       setDate]       = useState('')
  const [dist,       setDist]       = useState('5')
  const [customKm,   setCustomKm]   = useState(5)
  const [typeSel,    setTypeSel]    = useState('')
  const [typeCustom, setTypeCustom] = useState('')
  const [h,          setH]          = useState('0')
  const [m,          setM]          = useState('')
  const [s,          setS]          = useState('')
  const [mainGoal,   setMainGoal]   = useState(false)
  const [notes,      setNotes]      = useState('')
  const [saving,     setSaving]     = useState(false)

  // Reset telkens wanneer de modal opent (ook bij een nieuwe race ná een net
  // toegevoegde race — anders blijven naam/datum/… van de vorige race staan).
  useEffect(() => {
    if (!visible) return
    const km = activity?.km ?? null
    const rt = activity?.raceType ?? ''
    const g  = parseGoal(activity?.goalTime ?? '')
    setName(activity?.titel ?? '')
    setDate(activity?.datum ?? prefillDate ?? today)
    setDist(matchDist(km))
    setCustomKm(km != null && matchDist(km) === 'other' ? km : 5)
    setTypeSel(RACE_TYPES.includes(rt) ? rt : rt ? '__custom' : '')
    setTypeCustom(RACE_TYPES.includes(rt) ? '' : rt)
    setH(g.h); setM(g.m); setS(g.s)
    setMainGoal(activity?.isMainGoal ?? false)
    setNotes(activity?.detail ?? '')
  }, [visible, activity?.id, prefillDate])

  const distOpts: ChipOption[] = RACE_DIST.map(d => ({ key: d.key, label: d.label }))
  const typeOpts: ChipOption[] = [...RACE_TYPES.map(r => ({ key: r, label: r })), { key: '__custom', label: 'Anders' }]
  const selKm    = dist === 'other' ? customKm : RACE_DIST.find(d => d.key === dist)!.km
  const raceType = typeSel === '__custom' ? typeCustom : typeSel
  const totalSec = (parseInt(h || '0') * 3600) + (parseInt(m || '0') * 60) + parseInt(s || '0')
  const pace     = paceStr(totalSec, selKm)
  const dleft    = daysUntil(date)
  const hasGoal  = totalSec > 0

  async function handleSave() {
    if (!name || !date) { showToast('Naam en datum zijn verplicht'); return }
    if (!schemaId) { showToast('Geen schema gekoppeld'); return }

    setSaving(true)
    try {
      const goalTime = hasGoal ? (parseInt(h || '0') > 0
        ? `${parseInt(h || '0')}:${(m || '0').padStart(2, '0')}:${(s || '0').padStart(2, '0')}`
        : `${parseInt(m || '0')}:${(s || '0').padStart(2, '0')}`) : null
      const payload = {
        datum: date, titel: name, type: 'race' as const, km: selKm,
        detail: notes, raceType: raceType || null, goalTime, isMainGoal: mainGoal,
      }
      if (isEdit) {
        const updated = await patchActivity(schemaId, activity!.id, payload)
        upsertActivity({ ...activity!, ...updated })
      } else {
        const created = await createActivity(schemaId, payload)
        upsertActivity(created)
      }
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast('✓ Race opgeslagen')
      onClose()
    } catch {
      showToast('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalSheet
      visible={visible}
      title={isEdit ? 'Race bewerken' : 'Race toevoegen'}
      subtitle="Je eerstvolgende doel — bovenaan elk scherm."
      accentDot={raceHex}
      onClose={onClose}
      footer={<SaveBar label="Opslaan" onSave={handleSave} onCancel={onClose} saving={saving} />}
    >
      <View style={{ gap: Spacing.lg }}>
        {/* Race-first hero */}
        <View style={[styles.hero, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.heroTop}>
            <Text style={[styles.heroLabel, { color: t.muted }]}>RACE NAAM</Text>
            <View style={styles.heroCount}>
              <Text style={[styles.heroCountNum, { color: raceHex }]}>{dleft > 0 ? dleft : 0}</Text>
              <Text style={[styles.heroCountUnit, { color: raceHex }]}>{Math.abs(dleft) === 1 ? 'dag' : 'dagen'}</Text>
            </View>
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Naam"
            placeholderTextColor={t.faint}
            style={[styles.heroName, { color: t.text }]}
          />
          <View style={[styles.heroDivider, { backgroundColor: t.border }]} />
          <View style={styles.heroToggleRow}>
            <Toggle on={mainGoal} onChange={setMainGoal} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroToggleLabel, { color: t.text }]}>Hoofddoel (A-race)</Text>
              <Text style={[styles.heroToggleSub, { color: t.muted }]}>Stuurt de aftelteller op je startscherm.</Text>
            </View>
          </View>
        </View>

        <View>
          <FieldLabel>Datum</FieldLabel>
          <DayPicker value={date} onChange={setDate} />
        </View>

        <View>
          <FieldLabel>Afstand</FieldLabel>
          <ChipSelect options={distOpts} value={dist} onChange={setDist} />
          {dist === 'other' && (
            <View style={{ marginTop: Spacing.sm }}>
              <DistanceStepper value={customKm} onChange={setCustomKm} presets={[5, 8, 12, 30]} />
            </View>
          )}
        </View>

        <View>
          <FieldLabel>Type race</FieldLabel>
          <ChipSelect options={typeOpts} value={typeSel} onChange={setTypeSel} />
          {typeSel === '__custom' && (
            <View style={{ marginTop: Spacing.sm }}>
              <EditorTextField value={typeCustom} onChangeText={setTypeCustom} placeholder="bv. Veldloop" />
            </View>
          )}
        </View>

        {/* Doeltijd met live tempo */}
        <View>
          <FieldLabel hint="· optioneel">Doeltijd</FieldLabel>
          <View style={styles.timeRow}>
            <View style={[styles.timeBox, { backgroundColor: t.surface, borderColor: t.border }]}>
              <TimeSeg value={h} onChange={setH} unit="u" max={9} />
              <Colon />
              <TimeSeg value={m} onChange={setM} unit="m" max={59} />
              <Colon />
              <TimeSeg value={s} onChange={setS} unit="s" max={59} />
            </View>
            <View style={[styles.paceBox, { backgroundColor: t.text }]}>
              <Text style={[styles.paceLabel, { color: t.bg }]}>BENODIGD TEMPO</Text>
              <Text style={[styles.paceValue, { color: t.accent }]}>
                {pace}<Text style={[styles.paceUnit, { color: t.bg }]}> /km</Text>
              </Text>
            </View>
          </View>
        </View>

        <View>
          <FieldLabel hint="· optioneel">Notities</FieldLabel>
          <EditorTextArea value={notes} onChangeText={setNotes} placeholder="Strategie, pacers, splits…" />
        </View>
      </View>
    </ModalSheet>
  )
}

function TimeSeg({ value, onChange, unit, max }: { value: string; onChange: (v: string) => void; unit: string; max: number }) {
  const t = useTheme()
  return (
    <View style={styles.seg}>
      <TextInput
        value={value}
        inputMode="numeric"
        keyboardType="number-pad"
        onChangeText={raw => {
          let v = raw.replace(/\D/g, '').slice(0, 2)
          if (v !== '' && parseInt(v) > max) v = String(max)
          onChange(v)
        }}
        placeholder="0"
        placeholderTextColor={t.faint}
        style={[styles.segInput, { color: t.text }]}
      />
      <Text style={[styles.segUnit, { color: t.muted }]}>{unit}</Text>
    </View>
  )
}

function Colon() {
  const t = useTheme()
  return <Text style={[styles.colon, { color: t.muted }]}>:</Text>
}

const styles = StyleSheet.create({
  hero:           { borderWidth: 1, borderRadius: Radius.lg, padding: 16 },
  heroTop:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  heroLabel:      { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 0.4 },
  heroCount:      { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  heroCountNum:   { fontFamily: Fonts.displayBold, fontSize: 26, letterSpacing: -0.8, lineHeight: 28 },
  heroCountUnit:  { fontFamily: Fonts.displaySemiBold, fontSize: 13 },
  heroName:       { fontFamily: Fonts.displayBold, fontSize: 30, letterSpacing: -1, marginTop: 6, padding: 0 },
  heroDivider:    { height: 1, marginVertical: 11 },
  heroToggleRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroToggleLabel:{ fontFamily: Fonts.displayBold, fontSize: 13.5, letterSpacing: -0.15 },
  heroToggleSub:  { fontFamily: Fonts.display, fontSize: 11.5, marginTop: 2 },

  timeRow:        { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  timeBox:        { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 4 },
  seg:            { flexDirection: 'row', alignItems: 'baseline', gap: 3, paddingHorizontal: 4, paddingVertical: 8 },
  segInput:       { width: 32, textAlign: 'center', fontFamily: Fonts.displayBold, fontSize: 22, letterSpacing: -0.4, padding: 0 },
  segUnit:        { fontFamily: Fonts.displaySemiBold, fontSize: 12 },
  colon:          { fontFamily: Fonts.displayBold, fontSize: 20 },
  paceBox:        { width: 118, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center' },
  paceLabel:      { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 0.4, opacity: 0.6 },
  paceValue:      { fontFamily: Fonts.displayBold, fontSize: 19, letterSpacing: -0.4, marginTop: 2 },
  paceUnit:       { fontFamily: Fonts.displayMedium, fontSize: 11, opacity: 0.6 },
})
