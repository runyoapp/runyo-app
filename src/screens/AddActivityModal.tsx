import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { ModalSheet } from '@/components/shared/ModalSheet'
import {
  FieldLabel, EditorTextField, EditorTextArea, TypeSelect, InlineSelect,
  DistanceStepper, SaveBar, RestCard, activityDot, buildTypeOptions, type ChipOption,
} from '@/components/shared/editor'
import { DayPicker } from '@/components/shared/DayPicker'
import { IntervalEditor } from '@/components/shared/IntervalEditor'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { useTheme } from '@/hooks/useTheme'
import { createActivity } from '@/services/activities'
import { createSchema } from '@/services/schemas'
import { routeSchemaId } from '@/utils/schemaRouting'
import { Fonts, Spacing, schemaColor } from '@/constants/theme'
import { toDateString, fromDateString, DAYS_NL, MONTHS_NL } from '@/utils/date'
import type { ActivityType } from '@/constants/activities'
import type { IntervalBlock } from '@/types/activity'

type Props = {
  visible: boolean
  prefillDate?: string
  onClose: () => void
}

// Types waarbij een afstand logisch is
const DIST_TYPES = new Set<ActivityType>(['run', 'recovery', 'race', 'swim', 'bike'])

const TITLE_HINT: Record<ActivityType, string> = {
  run: 'bv. 16 km easy', recovery: 'bv. 6 km herstel', strength: 'bv. Onderlichaam · 45′',
  gym: 'bv. Krachttraining', mobility: 'bv. Rek + foamroll', rest: 'Rustdag',
  race: 'bv. BIG5 — 5 km', swim: 'bv. 2 km techniek', bike: 'bv. 40 km zone 2', work: 'bv. Lange dag',
}

function presetsFor(type: ActivityType): number[] {
  if (type === 'bike') return [20, 40, 60, 80]
  if (type === 'swim') return [1, 2, 3, 4]
  return [5, 10, 16, 21]
}

function friendlyDate(iso: string): string {
  const d = fromDateString(iso)
  if (isNaN(d.getTime())) return iso
  return `${DAYS_NL[(d.getDay() + 6) % 7].toLowerCase()} ${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${d.getFullYear()}`
}

export function AddActivityModal({ visible, prefillDate, onClose }: Props) {
  const theme          = useTheme()
  const queryClient    = useQueryClient()
  const schemaList     = useDataStore(s => s.schemaList)
  const activities     = useDataStore(s => s.activities)
  const activateImport = useDataStore(s => s.activateImport)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const showToast      = useUiStore(s => s.showToast)

  const today = toDateString(new Date())
  const [datum,    setDatum]    = useState(prefillDate ?? today)
  const [titel,    setTitel]    = useState('')
  const [type,     setType]     = useState<ActivityType>('run')
  const [km,       setKm]       = useState(0)
  const [detail,   setDetail]   = useState('')
  const [schemaId, setSchemaId] = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)
  // Sessie-velden (run): pace/HR + intervalblokken, identiek aan de bewerk-modal.
  const [targetPace,    setTargetPace]    = useState('')
  const [targetHr,      setTargetHr]      = useState('')
  const [intervals,     setIntervals]     = useState<IntervalBlock[]>([])
  const [intervalsOpen, setIntervalsOpen] = useState(false)

  // Het schema staat standaard op het plan waarvan de span de datum dekt en volgt de
  // datum, totdat de gebruiker zelf een schema kiest — dan blijft die keuze staan.
  const schemaTouched = useRef(false)

  useEffect(() => { setDatum(prefillDate ?? today) }, [prefillDate])
  useEffect(() => { if (visible) schemaTouched.current = false }, [visible])
  useEffect(() => {
    if (schemaTouched.current) return
    setSchemaId(routeSchemaId(datum, schemaList, activities))
  }, [datum, schemaList, activities])

  const typeOpts = buildTypeOptions(type)
  // Alleen schema's die op 'weergeven' staan zijn koppelbaar.
  const schemaChips: ChipOption[] = schemaList
    .filter(s => s.isVisible && !s.isArchived)
    .map(s => ({ key: s.id, label: s.name, dot: schemaColor(s, schemaList) }))
  const isRest  = type === 'rest'
  const isRun   = type === 'run'
  const hasDist = DIST_TYPES.has(type)
  const headDot = activityDot(type) ?? undefined

  function resetForm() {
    setTitel(''); setKm(0); setDetail(''); setType('run')
    setTargetPace(''); setTargetHr(''); setIntervals([]); setIntervalsOpen(false)
  }

  // Schrijft de activiteit naar het gekozen schema en bevestigt met een toast.
  async function persist(activeSchemaId: string) {
    const kmVal = isRest || !hasDist || km <= 0 ? null : km
    const hrNum = targetHr.trim() ? Number(targetHr.trim()) : null
    const created = await createActivity(activeSchemaId, {
      datum, titel: isRest ? null : titel, type, km: kmVal, detail: isRest ? null : detail,
      // Sessie-velden alleen voor runs.
      targetPace: isRun ? (targetPace.trim() || null) : null,
      targetHr: isRun && hrNum != null && !Number.isNaN(hrNum) ? hrNum : null,
      intervals: isRun && intervals.length ? intervals : null,
    })
    upsertActivity(created)
    await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', activeSchemaId] })
    const name = schemaList.find(s => s.id === activeSchemaId)?.name ?? 'schema'
    showToast(`✓ Toegevoegd aan ${name}`)
    resetForm()
    onClose()
  }

  function handleSchemaPick(id: string) {
    schemaTouched.current = true
    setSchemaId(id)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (schemaId) {
        await persist(schemaId)
      } else {
        // Geen zichtbaar schema → maak er één (bestaande fallback).
        const { id } = await createSchema('Mijn schema')
        await activateImport(id, 'Mijn schema')
        await persist(id)
      }
    } catch {
      showToast('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalSheet
      visible={visible}
      title="Activiteit toevoegen"
      subtitle={friendlyDate(datum)}
      accentDot={headDot}
      onClose={onClose}
      footer={<SaveBar label="Toevoegen" onSave={handleSave} onCancel={onClose} saving={saving} />}
    >
      <View style={{ gap: Spacing.lg }}>
        {!isRest && (
          <View>
            <FieldLabel>Titel</FieldLabel>
            <EditorTextField value={titel} onChangeText={setTitel} placeholder={TITLE_HINT[type]} />
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
          <RestCard note="Geen training — plan een herstelblok in." />
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
              <EditorTextArea value={detail} onChangeText={setDetail} placeholder="Notities, tempo, HR…" />
            </View>
          </>
        )}

        {/* Schema-koppeling helemaal onderaan (alleen bij 2+ koppelbare schema's). */}
        {schemaChips.length > 1 && (
          <View>
            <FieldLabel hint="· koppelen">Schema</FieldLabel>
            <InlineSelect options={schemaChips} value={schemaId ?? ''} onChange={handleSchemaPick} title="Aan welk schema?" />
          </View>
        )}
      </View>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  paceRow:          { flexDirection: 'row', gap: 10 },
  intervalsHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  intervalsChevron: { fontFamily: Fonts.display, fontSize: 17 },
  intervalsChevronOpen: { transform: [{ rotate: '90deg' }] },
})
