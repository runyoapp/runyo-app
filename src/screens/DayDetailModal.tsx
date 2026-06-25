import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { ModalSheet } from '@/components/shared/ModalSheet'
import {
  FieldLabel, EditorTextField, EditorTextArea, TypeSelect, InlineSelect,
  DistanceStepper, SaveBar, RestCard, activityDot, buildTypeOptions, type ChipOption,
} from '@/components/shared/editor'
import { DayPicker } from '@/components/shared/DayPicker'
import { MetricPills, IntervalBlocks } from '@/components/shared/MetricPills'
import { IntervalEditor } from '@/components/shared/IntervalEditor'
import { deriveActivityMetrics } from '@/utils/activityMetrics'
import { FeedbackSection, FeedbackDisplay } from '@/components/today/FeedbackSection'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { commitDelete, saveActivity, validateDeleteContext, type SaveInput } from '@/services/activityEdit'
import { patchActivity, moveActivity } from '@/services/activities'
import { TYPE_DISPLAY } from '@/constants/activities'
import { ActivityColors, Fonts, Spacing, Radius, schemaColor } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { fromDateString, DAYS_NL, MONTHS_FULL_NL, MONTHS_NL, mondayIndex } from '@/utils/date'
import type { Activity, ActivityType, IntervalBlock } from '@/types/activity'

const EMOJIS = ['😵', '😓', '😐', '💪', '🔥']
function buildFeedbackString(rating: number, text: string): string {
  return `${rating}/5 ${EMOJIS[rating - 1]}${text ? ` – ${text}` : ''}`
}

const DIST_TYPES = new Set<ActivityType>(['run', 'recovery', 'race', 'swim', 'bike'])

function presetsFor(type: ActivityType): number[] {
  if (type === 'bike') return [20, 40, 60, 80]
  if (type === 'swim') return [1, 2, 3, 4]
  return [5, 10, 16, 21]
}

function friendlyDate(iso: string): string {
  const d = fromDateString(iso)
  if (isNaN(d.getTime())) return iso
  return `${DAYS_NL[mondayIndex(d)].toLowerCase()} ${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${d.getFullYear()}`
}

type Props = {
  activity: Activity | null
  visible: boolean
  onClose: () => void
  startInFeedback?: boolean
}

export function DayDetailModal({ activity, visible, onClose, startInFeedback }: Props) {
  const theme          = useTheme()
  const queryClient    = useQueryClient()
  const getToken       = useAuthStore(s => s.getToken)
  const schemaList     = useDataStore(s => s.schemaList)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const removeActivity = useDataStore(s => s.removeActivity)
  // Live versie uit de store — zo blijft de weergave (o.a. beoordeling) actueel
  // nadat upsertActivity de activiteit heeft bijgewerkt; de prop is een snapshot.
  const liveActivity   = useDataStore(s => s.activities.find(a => a.id === activity?.id))
  const showToast      = useUiStore(s => s.showToast)

  const [editing,         setEditing]         = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [editingFeedback, setEditingFeedback] = useState(false)

  // Edit-form state (gelift zodat de sticky opslaan-balk hem kan aansturen)
  const [datum,  setDatum]  = useState('')
  const [titel,  setTitel]  = useState('')
  const [type,   setType]   = useState<ActivityType>('run')
  const [km,     setKm]     = useState(0)
  const [detail, setDetail] = useState('')
  // Sessie-velden (run): pace/HR + intervalblokken. Intervallen tonen we als
  // één inklapbare sectie (standaard dicht) zodat de modal compact blijft.
  const [targetPace,    setTargetPace]    = useState('')
  const [targetHr,      setTargetHr]      = useState('')
  const [intervals,     setIntervals]     = useState<IntervalBlock[]>([])
  const [intervalsOpen, setIntervalsOpen] = useState(false)

  const pendingDelete = useRef<Activity | null>(null)
  const deleteTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!activity) return
    setEditing(false)
    setEditingFeedback(startInFeedback ?? false)
    setDatum(activity.datum)
    setTitel(activity.titel ?? '')
    setType((activity.type as ActivityType) ?? 'run')
    setKm(activity.km ?? 0)
    setDetail(activity.detail ?? '')
    setTargetPace(activity.targetPace ?? '')
    setTargetHr(activity.targetHr != null ? String(activity.targetHr) : '')
    setIntervals(activity.intervals ?? [])
    // Zit er al een interval in, dan opent de sectie meteen uitgeklapt.
    setIntervalsOpen((activity.intervals?.length ?? 0) > 0)
  }, [activity?.id])

  if (!activity) return null
  const act = liveActivity ?? activity

  const date      = fromDateString(act.datum)
  const dayLabel  = `${DAYS_NL[mondayIndex(date)]} ${date.getDate()} ${MONTHS_FULL_NL[date.getMonth()]}`
  const colors    = ActivityColors[act.type as ActivityType] ?? ActivityColors.run
  const typeLabel = TYPE_DISPLAY[act.type as ActivityType]?.nl ?? act.type

  const todayStr      = new Date().toISOString().split('T')[0]
  const isPast        = act.datum <= todayStr
  const canHaveFeedback = isPast && act.type !== 'rest' && act.type !== 'work'

  // Afgeleide metrics (struct-first + detail-fallback) voor de read-only weergave.
  const metrics = deriveActivityMetrics(act)

  const typeOpts = buildTypeOptions(type)
  const isRest  = type === 'rest'
  const isRun   = type === 'run'
  const hasDist = DIST_TYPES.has(type)
  const headDot = (editing ? activityDot(type) : colors.text) ?? undefined

  // Schema-koppeling: label in de weergave, kiezer (= verplaatsen) in het bewerkformulier.
  // Alleen schema's op 'weergeven' zijn doel, plus altijd het eigen schema (ook als dat
  // verborgen staat) zodat de huidige koppeling klopt.
  const ownSchema    = schemaList.find(s => s.id === act.schemaId) ?? null
  const schemaChips: ChipOption[] = schemaList
    .filter(s => !s.isArchived && (s.isVisible || s.id === act.schemaId))
    .map(s => ({ key: s.id, label: s.name, dot: schemaColor(s, schemaList) }))

  // Altijd het eigen schema van de activiteit gebruiken (niet het primaire) — anders
  // patcht/verwijdert een activiteit uit een niet-primair schema op het verkeerde pad.
  function makeCtx() {
    return { schemaId: act.schemaId, getToken }
  }

  async function handleFeedback(rating: number, text: string) {
    const feedback = buildFeedbackString(rating, text)
    try {
      upsertActivity({ ...act, feedback, rating })
      await patchActivity(act.schemaId, act.id, { feedback, rating })
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', act.schemaId] })
      setEditingFeedback(false)
      showToast('Beoordeling opgeslagen!')
    } catch {
      showToast('Opslaan mislukt, probeer opnieuw.')
    }
  }

  // Verplaats de activiteit naar een ander schema (directe actie, los van Opslaan).
  async function handleMove(targetId: string) {
    if (targetId === act.schemaId) return
    setSaving(true)
    try {
      const moved = await moveActivity(act.schemaId, act.id, targetId)
      upsertActivity(moved)
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', act.schemaId] })
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', targetId] })
      const name = schemaList.find(s => s.id === targetId)?.name ?? 'schema'
      showToast(`✓ Verplaatst naar ${name}`)
    } catch {
      showToast('Verplaatsen mislukt')
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    const err = validateDeleteContext(act.schemaId)
    if (err) { showToast(err); return }
    const hrNum = targetHr.trim() ? Number(targetHr.trim()) : null
    const input: SaveInput = {
      datum, type,
      titel: isRest ? '' : titel,
      km: isRest || !hasDist || km <= 0 ? null : km,
      detail: isRest ? '' : detail,
      // Sessie-velden alleen voor runs; bij andere types op null zodat ze niet
      // ongepast blijven hangen na een type-wissel.
      targetPace: isRun ? (targetPace.trim() || null) : null,
      targetHr: isRun && hrNum != null && !Number.isNaN(hrNum) ? hrNum : null,
      intervals: isRun && intervals.length ? intervals : null,
    }
    setSaving(true)
    try {
      const updated = await saveActivity(act, input, makeCtx())
      upsertActivity(updated)
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', act.schemaId] })
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
    const err = validateDeleteContext(act.schemaId)
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
        await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', snap.schemaId] })
      } catch {
        upsertActivity(snap)
        showToast('Verwijderen mislukt')
      }
    }, 5000)
  }

  return (
    <ModalSheet
      visible={visible}
      title={editing ? 'Activiteit' : dayLabel}
      subtitle={editing ? friendlyDate(datum) : undefined}
      accentDot={headDot}
      onClose={onClose}
      footer={editing
        ? <SaveBar onSave={handleSave} onCancel={() => setEditing(false)} onDelete={handleDelete} saving={saving} />
        : undefined}
    >
      {!editing && (
        <View style={[styles.displayCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.badgeRow}>
            <View style={[styles.typeDot, { backgroundColor: colors.text }]} />
            <Text style={[styles.typeLabel, { color: theme.muted }]}>{typeLabel}</Text>
            {schemaChips.length > 1 && ownSchema && (
              <>
                <Text style={[styles.typeLabel, { color: theme.faint }]}>·</Text>
                <View style={[styles.typeDot, { backgroundColor: schemaColor(ownSchema, schemaList) }]} />
                <Text style={[styles.typeLabel, { color: theme.muted }]} numberOfLines={1}>{ownSchema.name}</Text>
              </>
            )}
          </View>
          {!!act.titel    && <Text style={[styles.displayTitle, { color: theme.text }]}>{act.titel}</Text>}
          {act.km != null && <Text style={[styles.displayKm, { color: theme.text }]}>{act.km}<Text style={[styles.displayKmUnit, { color: theme.muted }]}> km</Text></Text>}
          <MetricPills pace={metrics.pace} hr={metrics.hr} hasIntervals={metrics.hasIntervals} />
          {metrics.intervals && <IntervalBlocks theme={theme} intervals={metrics.intervals} />}
          {!!act.detail   && <Text style={[styles.displayDetail, { color: theme.muted }]}>{act.detail}</Text>}
          <TouchableOpacity style={[styles.editToggle, { borderTopColor: theme.border }]} onPress={() => setEditing(true)}>
            <Text style={[styles.editToggleText, { color: theme.muted }]}>Activiteit bewerken ›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* U43: feedback tonen/bewerken voor activiteiten in het verleden */}
      {!editing && canHaveFeedback && (
        <>
          {act.feedback && !editingFeedback && (
            <FeedbackDisplay feedback={act.feedback} onEdit={() => setEditingFeedback(true)} />
          )}
          {act.feedback && editingFeedback && (
            <FeedbackSection existing={act.feedback} onSubmit={handleFeedback} onCancel={() => setEditingFeedback(false)} />
          )}
          {!act.feedback && !editingFeedback && (
            <TouchableOpacity style={[styles.feedbackPrompt, { backgroundColor: theme.accentGlow }]} onPress={() => setEditingFeedback(true)}>
              <Text style={[styles.feedbackPromptText, { color: theme.accent }]}>Beoordeel deze training →</Text>
            </TouchableOpacity>
          )}
          {!act.feedback && editingFeedback && (
            <FeedbackSection existing={null} onSubmit={handleFeedback} onCancel={() => setEditingFeedback(false)} />
          )}
        </>
      )}

      {editing && (
        <View style={{ gap: Spacing.lg }}>
          {!isRest && (
            <View>
              <FieldLabel>Titel</FieldLabel>
              <EditorTextField value={titel} onChangeText={setTitel} placeholder="bv. 16 km easy" />
            </View>
          )}

          <View>
            <FieldLabel>Datum</FieldLabel>
            <DayPicker value={datum} onChange={setDatum} />
          </View>

          <View>
            <FieldLabel>Type</FieldLabel>
            <TypeSelect options={typeOpts} value={type} onChange={k => setType(k as ActivityType)} />
          </View>

          {isRest ? (
            <RestCard note="Geen training gepland. Herstel telt ook als werk." />
          ) : (
            <>
              {hasDist && (
                <View>
                  <FieldLabel hint="· optioneel">Afstand</FieldLabel>
                  <DistanceStepper value={km} onChange={setKm} presets={presetsFor(type)} />
                </View>
              )}

              {isRun && (
                <>
                  <View style={styles.paceRow}>
                    <View style={{ flex: 1 }}>
                      <FieldLabel>Streefpace</FieldLabel>
                      <EditorTextField value={targetPace} onChangeText={setTargetPace} placeholder="4:30" mono />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FieldLabel>Hartslag</FieldLabel>
                      <EditorTextField value={targetHr} onChangeText={setTargetHr} placeholder="145" keyboardType="numeric" />
                    </View>
                  </View>

                  <View>
                    <TouchableOpacity
                      style={styles.intervalsHead}
                      activeOpacity={0.7}
                      onPress={() => setIntervalsOpen(o => !o)}
                    >
                      <FieldLabel hint={intervals.length ? `· ${intervals.length} ${intervals.length === 1 ? 'blok' : 'blokken'}` : undefined}>
                        Intervallen
                      </FieldLabel>
                      <Text style={[styles.intervalsChevron, { color: theme.muted }, intervalsOpen && styles.intervalsChevronOpen]}>›</Text>
                    </TouchableOpacity>
                    {intervalsOpen && <IntervalEditor intervals={intervals} onChange={setIntervals} />}
                  </View>
                </>
              )}

              <View>
                <FieldLabel hint="· optioneel">Opmerkingen</FieldLabel>
                <EditorTextArea value={detail} onChangeText={setDetail} placeholder="Pace, hartslag, intervallen…" />
              </View>
            </>
          )}

          {/* Schema-koppeling helemaal onderaan (alleen bij 2+ koppelbare schema's). */}
          {schemaChips.length > 1 && (
            <View>
              <FieldLabel hint="· verplaatsen">Schema</FieldLabel>
              <InlineSelect options={schemaChips} value={act.schemaId} onChange={handleMove} title="Verplaatsen naar" />
            </View>
          )}
        </View>
      )}
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  displayCard:        { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm, borderWidth: 1 },
  badgeRow:           { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  typeDot:            { width: 8, height: 8, borderRadius: 4 },
  typeLabel:          { fontFamily: Fonts.displayMedium, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  displayTitle:       { fontFamily: Fonts.displayBold, fontSize: 22, letterSpacing: -0.3 },
  displayKm:          { fontFamily: Fonts.displayBold, fontSize: 40, letterSpacing: -1 },
  displayKmUnit:      { fontFamily: Fonts.display, fontSize: 18 },
  displayDetail:      { fontFamily: Fonts.display, fontSize: 14, lineHeight: 20 },
  feedbackPrompt:     { borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center' },
  feedbackPromptText: { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.2 },
  editToggle:         { paddingTop: Spacing.sm, borderTopWidth: 1 },
  editToggleText:     { fontFamily: Fonts.displayMedium, fontSize: 13 },
  paceRow:            { flexDirection: 'row', gap: 10 },
  intervalsHead:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  intervalsChevron:   { fontFamily: Fonts.display, fontSize: 17 },
  intervalsChevronOpen:{ transform: [{ rotate: '90deg' }] },
})
