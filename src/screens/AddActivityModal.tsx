import { useState, useEffect, useRef } from 'react'
import { View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { ModalSheet } from '@/components/shared/ModalSheet'
import {
  FieldLabel, EditorTextField, EditorTextArea, ChipSelect,
  DistanceStepper, SaveBar, RestCard, activityDot, type ChipOption,
} from '@/components/shared/editor'
import { DayPicker } from '@/components/shared/DayPicker'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { createActivity } from '@/services/activities'
import { createSchema } from '@/services/schemas'
import { routeSchemaId } from '@/utils/schemaRouting'
import { ACTIVITY_TYPES, TYPE_DISPLAY } from '@/constants/activities'
import { Spacing, schemaColor } from '@/constants/theme'
import { toDateString, fromDateString, DAYS_NL, MONTHS_NL } from '@/utils/date'
import type { ActivityType } from '@/constants/activities'

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

  // Het schema staat standaard op het plan waarvan de span de datum dekt en volgt de
  // datum, totdat de gebruiker zelf een schema kiest — dan blijft die keuze staan.
  const schemaTouched = useRef(false)

  useEffect(() => { setDatum(prefillDate ?? today) }, [prefillDate])
  useEffect(() => { if (visible) schemaTouched.current = false }, [visible])
  useEffect(() => {
    if (schemaTouched.current) return
    setSchemaId(routeSchemaId(datum, schemaList, activities))
  }, [datum, schemaList, activities])

  const typeOpts: ChipOption[] = ACTIVITY_TYPES.map(t => ({ key: t, label: TYPE_DISPLAY[t]?.nl ?? t, dot: activityDot(t) }))
  const schemaChips: ChipOption[] = schemaList
    .filter(s => !s.isArchived)
    .map(s => ({ key: s.id, label: s.name, dot: schemaColor(s, schemaList) }))
  const isRest  = type === 'rest'
  const hasDist = DIST_TYPES.has(type)
  const headDot = activityDot(type) ?? undefined

  // Schrijft de activiteit naar het gekozen schema en bevestigt met een toast.
  async function persist(activeSchemaId: string) {
    const kmVal = isRest || !hasDist || km <= 0 ? null : km
    const created = await createActivity(activeSchemaId, {
      datum, titel: isRest ? null : titel, type, km: kmVal, detail: isRest ? null : detail,
    })
    upsertActivity(created)
    await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', activeSchemaId] })
    const name = schemaList.find(s => s.id === activeSchemaId)?.name ?? 'schema'
    showToast(`✓ Toegevoegd aan ${name}`)
    setTitel(''); setKm(0); setDetail(''); setType('run')
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
        <View>
          <FieldLabel>Datum</FieldLabel>
          <DayPicker value={datum} onChange={setDatum} />
        </View>

        <View>
          <FieldLabel>Type</FieldLabel>
          <ChipSelect options={typeOpts} value={type} onChange={k => setType(k as ActivityType)} />
        </View>

        {schemaChips.length > 0 && (
          <View>
            <FieldLabel hint="· koppelen">Schema</FieldLabel>
            <ChipSelect options={schemaChips} value={schemaId ?? ''} onChange={handleSchemaPick} />
          </View>
        )}

        {isRest ? (
          <RestCard note="Geen training — plan een herstelblok in." />
        ) : (
          <>
            <View>
              <FieldLabel>Titel</FieldLabel>
              <EditorTextField value={titel} onChangeText={setTitel} placeholder={TITLE_HINT[type]} />
            </View>

            {hasDist && (
              <View>
                <FieldLabel hint="· optioneel">Afstand</FieldLabel>
                <DistanceStepper value={km} onChange={setKm} presets={presetsFor(type)} />
              </View>
            )}

            <View>
              <FieldLabel hint="· optioneel">Detail</FieldLabel>
              <EditorTextArea value={detail} onChangeText={setDetail} placeholder="Notities, tempo, HR…" />
            </View>
          </>
        )}
      </View>
    </ModalSheet>
  )
}
