import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { ModalSheet } from '@/components/shared/ModalSheet'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { appendActivity, updateActivity } from '@/services/sheets'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import type { Activity } from '@/types/activity'

const DISTANCES = ['5 km', '10 km', '10 mile', 'Halve marathon', 'Marathon']
const RACE_TYPES = ['Weg', 'Baan', 'Trail', 'Ultra', 'Virtueel']

type Props = {
  activity: Activity | null   // null = new race
  prefillDate?: string
  visible: boolean
  onClose: () => void
}

export function RaceModal({ activity, prefillDate, visible, onClose }: Props) {
  const queryClient    = useQueryClient()
  const getToken       = useAuthStore(s => s.getToken)
  const sheetId        = useDataStore(s => s.sheetId)
  const tabName        = useDataStore(s => s.tabName)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const showToast      = useUiStore(s => s.showToast)

  const isEdit = !!activity

  const [name,       setName]       = useState('')
  const [date,       setDate]       = useState('')
  const [distSel,    setDistSel]    = useState('')
  const [distCustom, setDistCustom] = useState('')
  const [typeSel,    setTypeSel]    = useState('')
  const [typeCustom, setTypeCustom] = useState('')
  const [goal,       setGoal]       = useState('')
  const [notes,      setNotes]      = useState('')
  const [mainGoal,   setMainGoal]   = useState(false)
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    const km = activity?.km != null ? String(activity.km) : ''
    const rt = activity?.raceType ?? ''
    setName(activity?.titel ?? '')
    setDate(activity?.datum ?? prefillDate ?? '')
    setDistSel(DISTANCES.includes(km) ? km : km ? '__custom' : '')
    setDistCustom(DISTANCES.includes(km) ? '' : km)
    setTypeSel(RACE_TYPES.includes(rt) ? rt : rt ? '__custom' : '')
    setTypeCustom(RACE_TYPES.includes(rt) ? '' : rt)
    setGoal(activity?.detail?.match(/\(Doel:\s*([^)]+)\)/)?.[1] ?? '')
    setNotes(activity?.detail?.replace(/\s*\(Doel:[^)]*\)/g, '').trim() ?? '')
    setMainGoal(false)
  }, [activity?.id, prefillDate])

  const dist      = distSel === '__custom' ? distCustom : distSel
  const raceType  = typeSel === '__custom' ? typeCustom : typeSel

  async function handleSave() {
    if (!name || !date) { showToast('Naam en datum zijn verplicht'); return }
    if (!sheetId) { showToast('Geen schema gekoppeld'); return }
    const token = await getToken()
    if (!token) return

    setSaving(true)
    try {
      const detail = notes + (goal ? ` (Doel: ${goal})` : '')
      const kmNum  = parseFloat(dist) || null

      if (isEdit && activity!.rowIndex) {
        await updateActivity(sheetId, tabName, token, activity!.rowIndex, {
          datum: date, titel: name, type: 'race', km: kmNum, detail, raceType,
        })
        upsertActivity({ ...activity!, datum: date, titel: name, km: kmNum, detail, raceType })
      } else {
        await appendActivity(sheetId, tabName, token, {
          datum: date, titel: name, type: 'race', km: kmNum, detail,
          feedback: null, fase: null, raceType,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['activities', 'sheets', sheetId, tabName] })
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
      onClose={onClose}
    >
      <Field label="Race naam">
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Big10 Rotterdam" placeholderTextColor={LightTheme.faint} />
      </Field>

      <Field label="Datum">
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={LightTheme.faint} keyboardType="numbers-and-punctuation" />
      </Field>

      <Field label="Afstand">
        <View style={styles.chipRow}>
          {DISTANCES.map(d => (
            <TouchableOpacity key={d} style={[styles.chip, distSel === d && styles.chipActive]} onPress={() => setDistSel(d)}>
              <Text style={[styles.chipText, distSel === d && styles.chipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.chip, distSel === '__custom' && styles.chipActive]} onPress={() => setDistSel('__custom')}>
            <Text style={[styles.chipText, distSel === '__custom' && styles.chipTextActive]}>Anders</Text>
          </TouchableOpacity>
        </View>
        {distSel === '__custom' && (
          <TextInput style={[styles.input, { marginTop: Spacing.sm }]} value={distCustom} onChangeText={setDistCustom} placeholder="bijv. 800 m" placeholderTextColor={LightTheme.faint} />
        )}
      </Field>

      <Field label="Type race">
        <View style={styles.chipRow}>
          {RACE_TYPES.map(t => (
            <TouchableOpacity key={t} style={[styles.chip, typeSel === t && styles.chipActive]} onPress={() => setTypeSel(t)}>
              <Text style={[styles.chipText, typeSel === t && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.chip, typeSel === '__custom' && styles.chipActive]} onPress={() => setTypeSel('__custom')}>
            <Text style={[styles.chipText, typeSel === '__custom' && styles.chipTextActive]}>Anders</Text>
          </TouchableOpacity>
        </View>
        {typeSel === '__custom' && (
          <TextInput style={[styles.input, { marginTop: Spacing.sm }]} value={typeCustom} onChangeText={setTypeCustom} placeholder="bijv. Veldloop" placeholderTextColor={LightTheme.faint} />
        )}
      </Field>

      <Field label="Doeltijd (optioneel)">
        <TextInput style={styles.input} value={goal} onChangeText={setGoal} placeholder="bijv. 37:30" placeholderTextColor={LightTheme.faint} keyboardType="numbers-and-punctuation" />
      </Field>

      <Field label="Notities">
        <TextInput style={[styles.input, styles.textarea]} value={notes} onChangeText={setNotes} placeholder="Parcours, strategie…" placeholderTextColor={LightTheme.faint} multiline numberOfLines={3} textAlignVertical="top" />
      </Field>

      <TouchableOpacity style={styles.mainGoalRow} onPress={() => setMainGoal(v => !v)}>
        <View style={[styles.checkbox, mainGoal && styles.checkboxActive]}>
          {mainGoal && <Text style={styles.checkMark}>✓</Text>}
        </View>
        <View>
          <Text style={styles.mainGoalLabel}>Hoofddoel</Text>
          <Text style={styles.mainGoalSub}>Markeer als belangrijkste race</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Opslaan…' : 'Race opslaan'}</Text>
      </TouchableOpacity>
    </ModalSheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontFamily: Fonts.displaySemiBold, fontSize: 12, color: LightTheme.muted, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  input:          { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.text, backgroundColor: LightTheme.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: LightTheme.border },
  textarea:       { minHeight: 72, textAlignVertical: 'top' },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip:           { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill, backgroundColor: LightTheme.surface, borderWidth: 1, borderColor: LightTheme.border },
  chipActive:     { backgroundColor: LightTheme.accent, borderColor: LightTheme.accent },
  chipText:       { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.muted },
  chipTextActive: { color: '#fff' },
  mainGoalRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox:       { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: LightTheme.border, backgroundColor: LightTheme.surface, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: LightTheme.accent, borderColor: LightTheme.accent },
  checkMark:      { fontFamily: Fonts.displayBold, fontSize: 13, color: '#fff', lineHeight: 18 },
  mainGoalLabel:  { fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text },
  mainGoalSub:    { fontFamily: Fonts.display, fontSize: 12, color: LightTheme.muted, marginTop: 1 },
  saveBtn:        { backgroundColor: LightTheme.accent, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  saveBtnDisabled:{ opacity: 0.5 },
  saveBtnText:    { fontFamily: Fonts.displaySemiBold, fontSize: 15, color: '#fff' },
})
