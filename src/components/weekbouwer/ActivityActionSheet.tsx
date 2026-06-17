import { useMemo, useState } from 'react'
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/hooks/useTheme'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { patchActivity, createActivity, deleteActivity } from '@/services/activities'
import { ActionMenu, type ActionMenuItem } from '@/components/shared/ActionMenu'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import { activityColor } from '@/utils/runCategory'
import { DAYS_NL, MONTHS_NL, fromDateString, addDays, toDateString } from '@/utils/date'
import type { Activity } from '@/types/activity'

type Props = {
  activity: Activity | null
  weekMonday: string
  onClose: () => void
  onEdit: (activity: Activity) => void
}

function dayLabel(datum: string): string {
  const d = fromDateString(datum)
  return `${DAYS_NL[(d.getDay() + 6) % 7].toLowerCase()} ${d.getDate()}`
}

function fullDayLabel(datum: string): string {
  const d = fromDateString(datum)
  return `${DAYS_NL[(d.getDay() + 6) % 7].toLowerCase()} ${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
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

export function ActivityActionSheet({ activity, weekMonday, onClose, onEdit }: Props) {
  const theme          = useTheme()
  const allActivities  = useDataStore(s => s.activities)
  const schemaId       = useDataStore(s => s.schemaId)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const removeActivity = useDataStore(s => s.removeActivity)
  const showToast      = useUiStore(s => s.showToast)
  const queryClient    = useQueryClient()

  const [moveOpen, setMoveOpen] = useState(false)

  // Lege dagen van de week (geen niet-werk activiteit) — voor verplaatsen/dupliceren.
  const emptyDays = useMemo(() => {
    const mon = fromDateString(weekMonday)
    const occupied = new Set(
      allActivities.filter(a => a.type !== 'work').map(a => a.datum),
    )
    return Array.from({ length: 7 }, (_, i) => toDateString(addDays(mon, i)))
      .filter(datum => !occupied.has(datum))
  }, [allActivities, weekMonday])

  if (!activity) return null
  const act = activity

  async function commitMove(datum: string) {
    setMoveOpen(false)
    onClose()
    if (!schemaId) return
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

  async function handleDuplicate() {
    onClose()
    if (!schemaId) return
    const target = emptyDays[0]
    if (!target) {
      showToast('Geen lege dag deze week')
      return
    }
    try {
      const created = await createActivity(schemaId, copyInput(act, target))
      upsertActivity(created)
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast(`Gedupliceerd naar ${dayLabel(target)}`)
    } catch {
      showToast('Dupliceren mislukt, probeer opnieuw.')
    }
  }

  async function handleDelete() {
    onClose()
    if (!schemaId) return
    removeActivity(act.id)
    try {
      await deleteActivity(schemaId, act.id)
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast('Verwijderd')
    } catch {
      upsertActivity(act)
      showToast('Verwijderen mislukt, probeer opnieuw.')
    }
  }

  const moveItems: ActionMenuItem[] = emptyDays.map(datum => ({
    label: dayLabel(datum),
    onPress: () => commitMove(datum),
  }))

  const actions = [
    { icon: '✎', label: 'Bewerken', sub: 'afstand, intervallen, pace', onPress: () => onEdit(act) },
    { icon: '↔', label: 'Verplaatsen naar…', sub: 'kies een lege dag', onPress: () => setMoveOpen(true) },
    { icon: '⎘', label: 'Dupliceren', sub: 'naar eerstvolgende lege dag', onPress: handleDuplicate },
    { icon: '×', label: 'Verwijderen', danger: true, onPress: handleDelete },
  ]

  const kmSuffix = act.km != null && act.km > 0 ? ` · ${act.km} km` : ''

  return (
    <>
      <Modal visible transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.bg, borderTopColor: theme.border, paddingBottom: 28 }]}
            onPress={() => {}}
          >
            <View style={[styles.grabber, { backgroundColor: theme.border }]} />

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
          </Pressable>
        </Pressable>
      </Modal>

      <ActionMenu
        visible={moveOpen}
        title={emptyDays.length ? 'Verplaatsen naar…' : 'Geen lege dag deze week'}
        items={moveItems}
        onClose={() => setMoveOpen(false)}
      />
    </>
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

  actionList:  { gap: 6 },
  actionItem:  { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, borderRadius: Radius.md, borderWidth: 1 },
  actionIcon:  { width: 22, textAlign: 'center', fontSize: 15 },
  actionLabel: { fontFamily: Fonts.displaySemiBold, fontSize: 14, letterSpacing: -0.1 },
  actionSub:   { fontFamily: Fonts.display, fontSize: 11.5, marginTop: 1 },
  actionChevron:{ fontFamily: Fonts.display, fontSize: 16 },
})
