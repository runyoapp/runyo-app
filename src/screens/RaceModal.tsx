import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch } from 'react-native'
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
  const getToken       = useAuthStore(s => s.getToken)
  const sheetId        = useDataStore(s => s.sheetId)
  const tabName        = useDataStore(s => s.tabName)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const showToast      = useUiStore(s => s.showToast)

  const isEdit = !!activity

  const [name,       setName]       = useState(activity?.titel ?? '')
  const [date,       setDate]       = useState(activity?.datum ?? prefillDate ?? '')
  const [distSel,    setDistSel]    = useState(DISTANCES.includes(String(activity?.km ?? '')) ? String(activity?.km) : (activity?.km != null ? '__custom' : ''))
  const [distCustom, setDistCustom] = useState(DISTANCES.includes(String(activity?.km ?? '')) ? '' : String(activity?.km ?? ''))
  const [typeSel,    setTypeSel]    = useState(RACE_TYPES.includes(activity?.raceType ?? '') ? activity?.raceType ?? '' : (activity?.raceType ? '__custom' : ''))
  const [typeCustom, setTypeCustom] = useState(RACE_TYPES.includes(activity?.raceType ?? '') ? '' : activity?.raceType ?? '')
  const [goal,       setGoal]       = useState('')
  const [notes,      setNotes]      = useState(activity?.detail?.replace(/\s*\(Doel:[^)]*\)/g, '') ?? '')
  const [mainGoal,   setMainGoal]   = useState(false)
  const [saving,     setSaving]     = useState(false)

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

      <View style={styles.mainGoalRow}>
        <Text style={styles.mainGoalLabel}>Hoofddoel</Text>
        <Switch value={mainGoal} onValueChange={setMainGoal} trackColor={{ true: LightTheme.accent }} thumbColor="#fff" />
      </View>

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
  mainGoalRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mainGoalLabel:  { fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text },
  saveBtn:        { backgroundColor: LightTheme.accent, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  saveBtnDisabled:{ opacity: 0.5 },
  saveBtnText:    { fontFamily: Fonts.displaySemiBold, fontSize: 15, color: '#fff' },
})
