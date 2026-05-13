import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { ModalSheet } from '@/components/shared/ModalSheet'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { appendAndSort } from '@/services/sheets'
import { ACTIVITY_TYPES, TYPE_DISPLAY } from '@/constants/activities'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { toDateString } from '@/utils/date'
import type { ActivityType } from '@/constants/activities'

type Props = {
  visible: boolean
  prefillDate?: string
  onClose: () => void
}

export function AddActivityModal({ visible, prefillDate, onClose }: Props) {
  const getToken       = useAuthStore(s => s.getToken)
  const sheetId        = useDataStore(s => s.sheetId)
  const tabName        = useDataStore(s => s.tabName)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const showToast      = useUiStore(s => s.showToast)

  const today = toDateString(new Date())
  const [datum,  setDatum]  = useState(prefillDate ?? today)
  const [titel,  setTitel]  = useState('')
  const [type,   setType]   = useState<ActivityType>('run')
  const [km,     setKm]     = useState('')
  const [detail, setDetail] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync prefillDate when it changes
  useState(() => { setDatum(prefillDate ?? today) })

  async function handleSave() {
    if (!sheetId) { showToast('Geen schema gekoppeld'); return }
    const token = await getToken()
    if (!token) return
    setSaving(true)
    try {
      const kmVal = parseFloat(km) || null
      await appendAndSort(sheetId, tabName, token, {
        datum, titel, type, km: kmVal, detail, feedback: null, fase: null, raceType: null,
      })
      upsertActivity({
        id: `local_${Date.now()}`, datum, titel, type, km: kmVal, detail,
        feedback: null, fase: null, rating: null, raceType: null, rowIndex: null,
        updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
      })
      showToast('✓ Activiteit toegevoegd')
      setTitel(''); setKm(''); setDetail(''); setType('run')
      onClose()
    } catch {
      showToast('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalSheet visible={visible} title="Activiteit toevoegen" onClose={onClose}>
      <View style={styles.container}>
        <Field label="Datum">
          <TextInput
            style={styles.input}
            value={datum}
            onChangeText={setDatum}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={LightTheme.faint}
            keyboardType="numbers-and-punctuation"
          />
        </Field>

        <Field label="Type">
          <View style={styles.typeGrid}>
            {ACTIVITY_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, type === t && styles.typeChipActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>
                  {TYPE_DISPLAY[t]?.nl ?? t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Titel">
          <TextInput
            style={styles.input}
            value={titel}
            onChangeText={setTitel}
            placeholder="Bijv. Easy run"
            placeholderTextColor={LightTheme.faint}
          />
        </Field>

        <Field label="Afstand (km)">
          <TextInput
            style={styles.input}
            value={km}
            onChangeText={setKm}
            placeholder="0"
            placeholderTextColor={LightTheme.faint}
            keyboardType="decimal-pad"
          />
        </Field>

        <Field label="Detail">
          <TextInput
            style={[styles.input, styles.textarea]}
            value={detail}
            onChangeText={setDetail}
            placeholder="Notities, tempo, HR…"
            placeholderTextColor={LightTheme.faint}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </Field>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Opslaan…' : 'Toevoegen'}</Text>
        </TouchableOpacity>
      </View>
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
  container:          { gap: Spacing.md },
  input:              { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.text, backgroundColor: LightTheme.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: LightTheme.border },
  textarea:           { minHeight: 72, textAlignVertical: 'top' },
  typeGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeChip:           { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill, backgroundColor: LightTheme.surface, borderWidth: 1, borderColor: LightTheme.border },
  typeChipActive:     { backgroundColor: LightTheme.accent, borderColor: LightTheme.accent },
  typeChipText:       { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.muted },
  typeChipTextActive: { color: '#fff' },
  saveBtn:            { backgroundColor: LightTheme.accent, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  saveBtnDisabled:    { opacity: 0.5 },
  saveBtnText:        { fontFamily: Fonts.displaySemiBold, fontSize: 15, color: '#fff' },
})
