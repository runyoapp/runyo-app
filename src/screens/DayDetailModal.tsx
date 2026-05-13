import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { ModalSheet } from '@/components/shared/ModalSheet'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { updateActivity, deleteActivity } from '@/services/sheets'
import { ACTIVITY_TYPES, TYPE_DISPLAY } from '@/constants/activities'
import { ActivityColors, LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { fromDateString, DAYS_NL, MONTHS_FULL_NL, mondayIndex } from '@/utils/date'
import type { Activity, ActivityType } from '@/types/activity'

type Props = {
  activity: Activity | null
  visible: boolean
  onClose: () => void
}

const FIELD_LABEL = StyleSheet.create({
  label: { fontFamily: Fonts.displaySemiBold, fontSize: 12, color: LightTheme.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
})

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={FIELD_LABEL.label}>{label}</Text>
      {children}
    </View>
  )
}

export function DayDetailModal({ activity, visible, onClose }: Props) {
  const getToken      = useAuthStore(s => s.getToken)
  const sheetId       = useDataStore(s => s.sheetId)
  const tabName       = useDataStore(s => s.tabName)
  const sheetTabId    = useDataStore(s => s.sheetTabId)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const removeActivity = useDataStore(s => s.removeActivity)
  const showToast     = useUiStore(s => s.showToast)

  const [editing, setEditing]   = useState(false)
  const [saving,  setSaving]    = useState(false)

  // Edit fields — sync whenever the activity changes
  const [datum,  setDatum]  = useState('')
  const [titel,  setTitel]  = useState('')
  const [type,   setType]   = useState<ActivityType>('run')
  const [km,     setKm]     = useState('')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    if (activity) {
      setDatum(activity.datum)
      setTitel(activity.titel ?? '')
      setType((activity.type as ActivityType) ?? 'run')
      setKm(activity.km != null ? String(activity.km) : '')
      setDetail(activity.detail ?? '')
      setEditing(false)
    }
  }, [activity?.id])

  if (!activity) return null

  const date     = fromDateString(activity.datum)
  const dayLabel = `${DAYS_NL[mondayIndex(date)]} ${date.getDate()} ${MONTHS_FULL_NL[date.getMonth()]}`
  const colors   = ActivityColors[activity.type as ActivityType] ?? ActivityColors.run
  const typeLabel = TYPE_DISPLAY[activity.type as ActivityType]?.nl ?? activity.type

  function resetEdit() {
    setDatum(activity.datum)
    setTitel(activity.titel)
    setType(activity.type as ActivityType)
    setKm(activity.km != null ? String(activity.km) : '')
    setDetail(activity.detail)
    setEditing(false)
  }

  async function handleSave() {
    if (!sheetId || !activity.rowIndex) { showToast('Geen schema gekoppeld'); return }
    const token = await getToken()
    if (!token) return
    setSaving(true)
    try {
      const kmVal = parseFloat(km) || null
      await updateActivity(sheetId, tabName, token, activity.rowIndex, {
        datum, titel, type, km: kmVal, detail,
      })
      upsertActivity({ ...activity, datum, titel, type, km: kmVal, detail })
      showToast('✓ Opgeslagen')
      setEditing(false)
      onClose()
    } catch {
      showToast('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!sheetId || !activity.rowIndex || !sheetTabId) return
    Alert.alert('Verwijderen?', activity.titel || typeLabel, [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen', style: 'destructive',
        onPress: async () => {
          const token = await getToken()
          if (!token) return
          try {
            await deleteActivity(sheetId, sheetTabId, token, activity.rowIndex! - 1)
            removeActivity(activity.id)
            showToast('Verwijderd')
            onClose()
          } catch {
            showToast('Verwijderen mislukt')
          }
        },
      },
    ])
  }

  return (
    <ModalSheet visible={visible} title={dayLabel} onClose={onClose}>
      {/* Activity display */}
      {!editing && (
        <View style={styles.displayCard}>
          <View style={styles.badgeRow}>
            <View style={[styles.typeDot, { backgroundColor: colors.text }]} />
            <Text style={styles.typeLabel}>{typeLabel}</Text>
          </View>
          {!!activity.titel && <Text style={styles.displayTitle}>{activity.titel}</Text>}
          {activity.km != null && (
            <Text style={styles.displayKm}>{activity.km}<Text style={styles.displayKmUnit}> km</Text></Text>
          )}
          {!!activity.detail && <Text style={styles.displayDetail}>{activity.detail}</Text>}
          {!!activity.feedback && (
            <View style={styles.feedbackChip}>
              <Text style={styles.feedbackText}>✓ {activity.feedback}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.editToggle} onPress={() => setEditing(true)}>
            <Text style={styles.editToggleText}>Activiteit bewerken ›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Edit form */}
      {editing && (
        <View style={styles.editForm}>
          <Field label="Datum">
            <TextInput
              style={styles.input}
              value={datum}
              onChangeText={setDatum}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={LightTheme.faint}
            />
          </Field>

          <Field label="Titel">
            <TextInput
              style={styles.input}
              value={titel}
              onChangeText={setTitel}
              placeholder="Titel"
              placeholderTextColor={LightTheme.faint}
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
            <Text style={styles.saveBtnText}>{saving ? 'Opslaan…' : 'Opslaan'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={resetEdit}>
            <Text style={styles.cancelBtnText}>Annuleren</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Verwijderen</Text>
          </TouchableOpacity>
        </View>
      )}
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  displayCard:      { backgroundColor: LightTheme.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  badgeRow:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  typeDot:          { width: 8, height: 8, borderRadius: 4 },
  typeLabel:        { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  displayTitle:     { fontFamily: Fonts.displayBold, fontSize: 22, color: LightTheme.text, letterSpacing: -0.3 },
  displayKm:        { fontFamily: Fonts.displayBold, fontSize: 40, color: LightTheme.text, letterSpacing: -1 },
  displayKmUnit:    { fontFamily: Fonts.display, fontSize: 18, color: LightTheme.muted },
  displayDetail:    { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.muted, lineHeight: 20 },
  feedbackChip:     { backgroundColor: LightTheme.accentGlow, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, alignSelf: 'flex-start' },
  feedbackText:     { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.accent },
  editToggle:       { paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: LightTheme.border },
  editToggleText:   { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.muted },
  editForm:         { gap: Spacing.md },
  input:            { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.text, backgroundColor: LightTheme.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: LightTheme.border },
  textarea:         { minHeight: 80, textAlignVertical: 'top' },
  typeGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeChip:         { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill, backgroundColor: LightTheme.surface, borderWidth: 1, borderColor: LightTheme.border },
  typeChipActive:   { backgroundColor: LightTheme.accent, borderColor: LightTheme.accent },
  typeChipText:     { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.muted },
  typeChipTextActive: { color: '#fff' },
  saveBtn:          { backgroundColor: LightTheme.accent, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  saveBtnDisabled:  { opacity: 0.5 },
  saveBtnText:      { fontFamily: Fonts.displaySemiBold, fontSize: 15, color: '#fff' },
  cancelBtn:        { alignItems: 'center', padding: Spacing.sm },
  cancelBtnText:    { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.muted },
  deleteBtn:        { alignItems: 'center', padding: Spacing.sm },
  deleteBtnText:    { fontFamily: Fonts.displayMedium, fontSize: 13, color: '#C8336B' },
})
