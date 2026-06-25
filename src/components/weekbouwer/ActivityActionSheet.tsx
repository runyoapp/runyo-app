import { useState } from 'react'
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/hooks/useTheme'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { patchActivity, createActivity } from '@/services/activities'
import { useDeleteActivityWithUndo } from '@/components/weekbouwer/useDeleteActivity'
import { Calendar } from '@/components/shared/DayPicker'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import { activityColor } from '@/utils/runCategory'
import { DAYS_NL, MONTHS_NL, MONTHS_FULL_NL, fromDateString, toDateString } from '@/utils/date'
import type { Activity } from '@/types/activity'

type Props = {
  activity: Activity | null
  onClose: () => void
  onEdit: (activity: Activity) => void
}

type Picker = 'move' | 'duplicate' | null

function dayLabel(datum: string): string {
  const d = fromDateString(datum)
  return `${DAYS_NL[(d.getDay() + 6) % 7].toLowerCase()} ${d.getDate()}`
}

function fullDayLabel(datum: string): string {
  const d = fromDateString(datum)
  return `${DAYS_NL[(d.getDay() + 6) % 7].toLowerCase()} ${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
}

// "12 juli" — voor de bevestigknop.
function targetLabel(datum: string): string {
  const d = fromDateString(datum)
  return `${d.getDate()} ${MONTHS_FULL_NL[d.getMonth()]}`
}

// Velden die we kopiëren bij dupliceren (geen feedback/rating).
function copyInput(activity: Activity, datum: string) {
  return {
    datum,
    type: activity.type,
    titel: activity.titel || null,
    detail: activity.detail || null,
    km: activity.km,
    targetPace: activity.targetPace,
    targetHr: activity.targetHr,
    intervals: activity.intervals,
  }
}

export function ActivityActionSheet({ activity, onClose, onEdit }: Props) {
  const theme          = useTheme()
  const schemaId       = useDataStore(s => s.schemaId)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const showToast      = useUiStore(s => s.showToast)
  const queryClient    = useQueryClient()
  const deleteWithUndo = useDeleteActivityWithUndo()

  const [picker, setPicker] = useState<Picker>(null)
  const [target, setTarget] = useState<string | null>(null)

  function openPicker(p: Picker) {
    setTarget(null)
    setPicker(p)
  }

  function close() {
    setPicker(null)
    setTarget(null)
    onClose()
  }

  if (!activity) return null
  const act = activity

  async function commitMove(datum: string) {
    close()
    if (!schemaId || datum === act.datum) return
    const moved = { ...act, datum }
    upsertActivity(moved)
    try {
      await patchActivity(schemaId, act.id, { datum })
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast(`Verplaatst naar ${dayLabel(datum)}`)
    } catch {
      upsertActivity(act)
      showToast('Verplaatsen mislukt, probeer opnieuw.')
    }
  }

  async function handleDuplicate(datum: string) {
    close()
    if (!schemaId) return
    try {
      const created = await createActivity(schemaId, copyInput(act, datum))
      upsertActivity(created)
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast(`Gedupliceerd naar ${dayLabel(datum)}`)
    } catch {
      showToast('Dupliceren mislukt, probeer opnieuw.')
    }
  }

  function handleDelete() {
    close()
    deleteWithUndo(act)
  }

  const actions = [
    { icon: '✎', label: 'Bewerken', sub: 'afstand, intervallen, pace', onPress: () => onEdit(act) },
    { icon: '↔', label: 'Verplaatsen naar…', sub: 'kies een dag in de kalender', onPress: () => openPicker('move') },
    { icon: '⎘', label: 'Dupliceren naar…', sub: 'kies een dag in de kalender', onPress: () => openPicker('duplicate') },
    { icon: '×', label: 'Verwijderen', danger: true, onPress: handleDelete },
  ]

  const kmSuffix = act.km != null && act.km > 0 ? ` · ${act.km} km` : ''
  const todayISO = toDateString(new Date())

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.bg, borderTopColor: theme.border, paddingBottom: 28 }]}
          onPress={() => {}}
        >
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />

          {picker ? (
            <>
              <View style={styles.pickerHead}>
                <Pressable
                  onPress={() => setPicker(null)}
                  hitSlop={10}
                  style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Text style={[styles.backChevron, { color: theme.text }]}>‹</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.headTitle, { color: theme.text }]} numberOfLines={1}>
                    {picker === 'move' ? 'Verplaatsen naar…' : 'Dupliceren naar…'}
                  </Text>
                  <Text style={[styles.headSub, { color: theme.muted }]}>
                    {act.titel || act.type} · nu {fullDayLabel(act.datum)}
                  </Text>
                </View>
              </View>

              <Calendar
                t={theme}
                selISO={target ?? act.datum}
                todayISO={todayISO}
                base={fromDateString(target ?? act.datum)}
                onPick={setTarget}
              />

              <Pressable
                disabled={!target}
                onPress={() => {
                  if (!target) return
                  picker === 'move' ? commitMove(target) : handleDuplicate(target)
                }}
                style={[
                  styles.confirmBtn,
                  { backgroundColor: target ? theme.accent : theme.surface2, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.confirmText, { color: target ? theme.accentInk : theme.muted }]}>
                  {target
                    ? `${picker === 'move' ? 'Verplaats' : 'Dupliceer'} naar ${targetLabel(target)}`
                    : 'Kies een dag in de kalender'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={[styles.sheetHead, { borderBottomColor: theme.border }]}>
                <View style={[styles.headBar, { backgroundColor: activityColor(act, theme) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.headTitle, { color: theme.text }]} numberOfLines={1}>
                    {act.titel || act.type}{kmSuffix}
                  </Text>
                  <Text style={[styles.headSub, { color: theme.muted }]}>{fullDayLabel(act.datum)}</Text>
                </View>
              </View>

              <View style={styles.actionList}>
                {actions.map(a => (
                  <Pressable
                    key={a.label}
                    onPress={a.onPress}
                    style={({ pressed }) => [
                      styles.actionItem,
                      {
                        backgroundColor: a.danger ? 'transparent' : theme.surface,
                        borderColor: a.danger ? 'transparent' : theme.border,
                      },
                      pressed && !a.danger && { backgroundColor: theme.surface2 },
                    ]}
                  >
                    <Text style={[styles.actionIcon, { color: a.danger ? theme.danger : theme.text }]}>{a.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.actionLabel, { color: a.danger ? theme.danger : theme.text }]}>{a.label}</Text>
                      {a.sub && <Text style={[styles.actionSub, { color: theme.muted }]}>{a.sub}</Text>}
                    </View>
                    {!a.danger && <Text style={[styles.actionChevron, { color: theme.muted }]}>›</Text>}
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(14,31,26,0.5)' },
  sheet:       { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, paddingHorizontal: Spacing.lg, paddingTop: 8 },
  grabber:     { width: 36, height: 4, borderRadius: 999, alignSelf: 'center', marginBottom: 14 },

  sheetHead:   { flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 14, marginBottom: 8, borderBottomWidth: 1 },
  headBar:     { width: 4, height: 36, borderRadius: 999 },
  headTitle:   { fontFamily: Fonts.displayBold, fontSize: 16, letterSpacing: -0.3 },
  headSub:     { fontFamily: Fonts.display, fontSize: 12, marginTop: 2 },

  pickerHead:  { flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 14, marginBottom: 4 },
  backBtn:     { width: 32, height: 32, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  backChevron: { fontFamily: Fonts.displaySemiBold, fontSize: 17, lineHeight: 20 },

  confirmBtn:  { marginTop: 14, borderWidth: 1, borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontFamily: Fonts.displaySemiBold, fontSize: 14, letterSpacing: -0.1 },

  actionList:  { gap: 6 },
  actionItem:  { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, borderRadius: Radius.md, borderWidth: 1 },
  actionIcon:  { width: 22, textAlign: 'center', fontSize: 15 },
  actionLabel: { fontFamily: Fonts.displaySemiBold, fontSize: 14, letterSpacing: -0.1 },
  actionSub:   { fontFamily: Fonts.display, fontSize: 11.5, marginTop: 1 },
  actionChevron:{ fontFamily: Fonts.display, fontSize: 16 },
})
