import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { ModalSheet } from '@/components/shared/ModalSheet'
import { FeedbackSection, FeedbackDisplay } from '@/components/today/FeedbackSection'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import {
  commitDelete, markAsRest, saveActivity,
  validateDeleteContext, type SaveInput,
} from '@/services/activityEdit'
import { patchActivity } from '@/services/activities'
import { ACTIVITY_TYPES, TYPE_DISPLAY } from '@/constants/activities'
import { ActivityColors, LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { fromDateString, DAYS_NL, MONTHS_FULL_NL, mondayIndex } from '@/utils/date'
import type { Activity, ActivityType } from '@/types/activity'

const EMOJIS = ['😵', '😓', '😐', '💪', '🔥']
function buildFeedbackString(rating: number, text: string): string {
  return `${rating}/5 ${EMOJIS[rating - 1]}${text ? ` – ${text}` : ''}`
}

type Props = {
  activity: Activity | null
  visible: boolean
  onClose: () => void
}

const LABEL_STYLE = StyleSheet.create({
  label: { fontFamily: Fonts.displaySemiBold, fontSize: 12, color: LightTheme.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
})

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={LABEL_STYLE.label}>{label}</Text>
      {children}
    </View>
  )
}

type EditFormProps = {
  act: Activity
  onSave: (input: SaveInput) => Promise<void>
  onCancel: () => void
  onDelete: () => void
  onMarkAsRest: () => Promise<void>
  saving: boolean
  marking: boolean
}

function EditForm({ act, onSave, onCancel, onDelete, onMarkAsRest, saving, marking }: EditFormProps) {
  const theme = useTheme()
  const [datum,  setDatum]  = useState(act.datum)
  const [titel,  setTitel]  = useState(act.titel ?? '')
  const [type,   setType]   = useState<ActivityType>((act.type as ActivityType) ?? 'run')
  const [km,     setKm]     = useState(act.km != null ? String(act.km) : '')
  const [detail, setDetail] = useState(act.detail ?? '')

  return (
    <View style={styles.editForm}>
      <Field label="Datum">
        <TextInput style={styles.input} value={datum} onChangeText={setDatum}
          placeholder="bijv. 2026-06-01" placeholderTextColor={LightTheme.faint} />
      </Field>

      <Field label="Titel">
        <TextInput style={styles.input} value={titel} onChangeText={setTitel}
          placeholder="Titel" placeholderTextColor={LightTheme.faint} />
      </Field>

      <Field label="Type">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -Spacing.lg }}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm, flexDirection: 'row' }}>
          {ACTIVITY_TYPES.map(t => (
            <TouchableOpacity key={t}
              style={[styles.typeChip, type === t && styles.typeChipActive]}
              onPress={() => setType(t)}>
              <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>
                {TYPE_DISPLAY[t]?.nl ?? t}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Field>

      <Field label="Afstand (km)">
        <TextInput style={styles.input} value={km} onChangeText={setKm}
          placeholder="0" placeholderTextColor={LightTheme.faint} keyboardType="decimal-pad" />
      </Field>

      <Field label="Detail">
        <TextInput style={[styles.input, styles.textarea]} value={detail} onChangeText={setDetail}
          placeholder="Notities, tempo, HR…" placeholderTextColor={LightTheme.faint}
          multiline numberOfLines={3} textAlignVertical="top" />
      </Field>

      <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={() => onSave({ datum, titel, type, km: parseFloat(km) || null, detail })}
        disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Opslaan…' : 'Opslaan'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelBtnText}>Annuleren</Text>
      </TouchableOpacity>

      {act.type !== 'rest' && (
        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={onMarkAsRest} disabled={marking}>
          <Text style={[styles.secondaryBtnText, { color: theme.muted }]}>
            {marking ? 'Bezig…' : 'Markeer als rustdag'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.deleteBtn, { backgroundColor: theme.dangerBg, borderColor: theme.danger }]}
        onPress={onDelete}>
        <Text style={[styles.deleteBtnText, { color: theme.danger }]}>Verwijderen</Text>
      </TouchableOpacity>
    </View>
  )
}

export function DayDetailModal({ activity, visible, onClose }: Props) {
  const theme          = useTheme()
  const queryClient    = useQueryClient()
  const getToken       = useAuthStore(s => s.getToken)
  const schemaId       = useDataStore(s => s.schemaId)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const removeActivity = useDataStore(s => s.removeActivity)
  const showToast      = useUiStore(s => s.showToast)

  const [editing,         setEditing]         = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [marking,         setMarking]         = useState(false)
  const [editingFeedback, setEditingFeedback] = useState(false)
  const pendingDelete = useRef<Activity | null>(null)
  const deleteTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { if (activity) { setEditing(false); setEditingFeedback(false) } }, [activity?.id])

  if (!activity) return null
  const act = activity

  const date      = fromDateString(act.datum)
  const dayLabel  = `${DAYS_NL[mondayIndex(date)]} ${date.getDate()} ${MONTHS_FULL_NL[date.getMonth()]}`
  const colors    = ActivityColors[act.type as ActivityType] ?? ActivityColors.run
  const typeLabel = TYPE_DISPLAY[act.type as ActivityType]?.nl ?? act.type

  const today         = new Date().toISOString().split('T')[0]
  const isPast        = act.datum <= today
  const canHaveFeedback = isPast && act.type !== 'rest' && act.type !== 'work'

  function makeCtx() {
    return { schemaId: schemaId!, getToken }
  }

  async function handleFeedback(rating: number, text: string) {
    if (!schemaId) return
    const feedback = buildFeedbackString(rating, text)
    try {
      upsertActivity({ ...act, feedback, rating })
      await patchActivity(schemaId, act.id, { feedback, rating })
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      setEditingFeedback(false)
      showToast('Beoordeling opgeslagen!')
    } catch {
      showToast('Opslaan mislukt, probeer opnieuw.')
    }
  }

  async function handleSave(input: SaveInput) {
    const err = validateDeleteContext(schemaId)
    if (err) { showToast(err); return }
    setSaving(true)
    try {
      const updated = await saveActivity(act, input, makeCtx())
      upsertActivity(updated)
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast('✓ Opgeslagen')
      setEditing(false)
      onClose()
    } catch {
      showToast('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  function handleDelete() {
    const err = validateDeleteContext(schemaId)
    if (err) { showToast(err); return }
    if (deleteTimer.current) clearTimeout(deleteTimer.current)
    pendingDelete.current = act
    removeActivity(act.id)
    onClose()
    showToast('Verwijderd', 5000, {
      label: 'Ongedaan',
      onPress: () => {
        if (deleteTimer.current) clearTimeout(deleteTimer.current)
        const snap = pendingDelete.current
        if (snap) upsertActivity(snap)
        pendingDelete.current = null
      },
    })
    deleteTimer.current = setTimeout(async () => {
      const snap = pendingDelete.current
      if (!snap) return
      pendingDelete.current = null
      try {
        await commitDelete(snap, makeCtx())
        await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      } catch {
        upsertActivity(snap)
        showToast('Verwijderen mislukt')
      }
    }, 5000)
  }

  async function handleMarkAsRest() {
    const err = validateDeleteContext(schemaId)
    if (err) { showToast(err); return }
    setMarking(true)
    try {
      const updated = await markAsRest(act, makeCtx())
      upsertActivity(updated)
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast('Gemarkeerd als rustdag')
      onClose()
    } catch {
      showToast('Markeren mislukt')
    } finally {
      setMarking(false)
    }
  }

  return (
    <ModalSheet visible={visible} title={dayLabel} onClose={onClose}>
      {!editing && (
        <View style={[styles.displayCard, { backgroundColor: theme.surface }]}>
          <View style={styles.badgeRow}>
            <View style={[styles.typeDot, { backgroundColor: colors.text }]} />
            <Text style={styles.typeLabel}>{typeLabel}</Text>
          </View>
          {!!activity.titel    && <Text style={styles.displayTitle}>{activity.titel}</Text>}
          {activity.km != null && <Text style={styles.displayKm}>{activity.km}<Text style={styles.displayKmUnit}> km</Text></Text>}
          {!!activity.detail   && <Text style={styles.displayDetail}>{activity.detail}</Text>}
          <TouchableOpacity style={styles.editToggle} onPress={() => setEditing(true)}>
            <Text style={styles.editToggleText}>Activiteit bewerken ›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* U43: feedback tonen/bewerken voor activiteiten in het verleden */}
      {!editing && canHaveFeedback && (
        <>
          {activity.feedback && !editingFeedback && (
            <FeedbackDisplay
              feedback={activity.feedback}
              onEdit={() => setEditingFeedback(true)}
            />
          )}
          {activity.feedback && editingFeedback && (
            <FeedbackSection
              existing={activity.feedback}
              onSubmit={handleFeedback}
              onCancel={() => setEditingFeedback(false)}
            />
          )}
          {!activity.feedback && !editingFeedback && (
            <TouchableOpacity
              style={[styles.feedbackPrompt, { backgroundColor: theme.accentGlow }]}
              onPress={() => setEditingFeedback(true)}
            >
              <Text style={[styles.feedbackPromptText, { color: theme.accent }]}>
                Beoordeel deze training →
              </Text>
            </TouchableOpacity>
          )}
          {!activity.feedback && editingFeedback && (
            <FeedbackSection
              existing={null}
              onSubmit={handleFeedback}
              onCancel={() => setEditingFeedback(false)}
            />
          )}
        </>
      )}

      {editing && (
        <EditForm
          act={act}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          onDelete={handleDelete}
          onMarkAsRest={handleMarkAsRest}
          saving={saving}
          marking={marking}
        />
      )}
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  displayCard:        { backgroundColor: LightTheme.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  badgeRow:           { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  typeDot:            { width: 8, height: 8, borderRadius: 4 },
  typeLabel:          { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  displayTitle:       { fontFamily: Fonts.displayBold, fontSize: 22, color: LightTheme.text, letterSpacing: -0.3 },
  displayKm:          { fontFamily: Fonts.displayBold, fontSize: 40, color: LightTheme.text, letterSpacing: -1 },
  displayKmUnit:      { fontFamily: Fonts.display, fontSize: 18, color: LightTheme.muted },
  displayDetail:      { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.muted, lineHeight: 20 },
  feedbackChip:       { backgroundColor: LightTheme.accentGlow, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, alignSelf: 'flex-start' },
  feedbackText:       { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.accent },
  feedbackPrompt:     { borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center' },
  feedbackPromptText: { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.2 },
  editToggle:         { paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: LightTheme.border },
  editToggleText:     { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.muted },
  editForm:           { gap: Spacing.md },
  input:              { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.text, backgroundColor: LightTheme.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: LightTheme.border },
  textarea:           { minHeight: 80, textAlignVertical: 'top' },
  typeChip:           { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill, backgroundColor: LightTheme.surface, borderWidth: 1, borderColor: LightTheme.border },
  typeChipActive:     { backgroundColor: LightTheme.accent, borderColor: LightTheme.accent },
  typeChipText:       { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.muted },
  typeChipTextActive: { color: '#fff' },
  saveBtn:            { backgroundColor: LightTheme.accent, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  saveBtnDisabled:    { opacity: 0.5 },
  saveBtnText:        { fontFamily: Fonts.displaySemiBold, fontSize: 15, color: '#fff' },
  cancelBtn:          { alignItems: 'center', padding: Spacing.sm },
  cancelBtnText:      { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.muted },
  secondaryBtn:       { alignItems: 'center', padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1 },
  secondaryBtnText:   { fontFamily: Fonts.displayMedium, fontSize: 13 },
  deleteBtn:          { alignItems: 'center', padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.xs },
  deleteBtnText:      { fontFamily: Fonts.displayMedium, fontSize: 13 },
})
