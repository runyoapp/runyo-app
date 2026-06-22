// runyo — gedeelde intervalblok-editor. Eén of meer blokken, elk met eigen
// herhaal-teller (bv. 2×400 + 3×800). Losgeweekt uit de weekbouwer-EditorScreen
// zodat de weekbouwer én de DayDetailModal exact dezelfde editor delen.
//
// Bewerk-flow: je opent één blok tegelijk (nieuw of bestaand) → invullen →
// "Interval opslaan" klapt het in tot een samenvatting. De knop "+ Interval
// toevoegen" verschijnt pas weer als er geen blok in bewerking is. Afstand/duur
// en herstel zijn een vrij invulveld + eenheidskiezer (m/km/s/min); de canonieke
// opslag blijft distanceKm/durationMin (geen backend-wijziging nodig).

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { FieldLabel, EditorTextField } from '@/components/shared/editor'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import type { Theme } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { intervalAmountUnit, type IntervalUnit } from '@/utils/activityMetrics'
import type { IntervalBlock } from '@/types/activity'

const UNITS: IntervalUnit[] = ['m', 'km', 's', 'min']

let blockSeq = 0
function newBlockId(): string {
  blockSeq += 1
  return `wb-${Date.now()}-${blockSeq}`
}

// Lokale bewerk-staat van het open blok (commit pas bij "Interval opslaan").
type Draft = {
  id: string
  isNew: boolean
  amount: string
  unit: IntervalUnit
  pace: string
  recAmount: string
  recUnit: IntervalUnit
  repeat: number
}

function parseRecovery(recovery: string | null): { amount: string; unit: IntervalUnit } {
  if (!recovery) return { amount: '', unit: 's' }
  const m = recovery.trim().match(/^([\d.,]+)\s*(m|km|s|min)$/i)
  if (m) return { amount: m[1].replace(',', '.'), unit: m[2].toLowerCase() as IntervalUnit }
  // Legacy "mm:ss" → seconden, zodat oude geïmporteerde herstel-waarden bewerkbaar blijven.
  const t = recovery.trim().match(/^(\d+):(\d{2})$/)
  if (t) return { amount: String(Number(t[1]) * 60 + Number(t[2])), unit: 's' }
  return { amount: '', unit: 's' }
}

function draftFromBlock(b: IntervalBlock): Draft {
  const du = intervalAmountUnit(b)
  const rec = parseRecovery(b.recovery)
  return {
    id: b.id, isNew: false,
    amount: du.amount, unit: du.unit,
    pace: b.pace ?? '',
    recAmount: rec.amount, recUnit: rec.unit,
    repeat: b.repeat,
  }
}

function emptyDraft(): Draft {
  return { id: newBlockId(), isNew: true, amount: '', unit: 'm', pace: '', recAmount: '', recUnit: 's', repeat: 1 }
}

function draftToBlock(d: Draft): IntervalBlock {
  const n = d.amount.trim() ? Number(d.amount.replace(',', '.')) : null
  const valid = n != null && !Number.isNaN(n)
  const distanceKm = valid && d.unit === 'm' ? n / 1000 : valid && d.unit === 'km' ? n : null
  const durationMin = valid && d.unit === 's' ? n / 60 : valid && d.unit === 'min' ? n : null

  const rn = d.recAmount.trim() ? Number(d.recAmount.replace(',', '.')) : null
  const recovery = rn != null && !Number.isNaN(rn) ? `${rn} ${d.recUnit}` : null

  return {
    id: d.id, label: null, repeat: Math.max(1, d.repeat),
    distanceKm, durationMin,
    // De gekozen eenheid exact bewaren zodat "400 m" niet als "0,4 km" terugkomt.
    amountUnit: valid ? d.unit : null,
    pace: d.pace.trim() || null, recovery,
  }
}

export function IntervalEditor({ intervals, onChange }: {
  intervals: IntervalBlock[]
  onChange: (next: IntervalBlock[]) => void
}) {
  const theme = useTheme()
  const [draft, setDraft] = useState<Draft | null>(null)

  function patch(p: Partial<Draft>) { setDraft(d => d ? { ...d, ...p } : d) }

  function save() {
    if (!draft) return
    const block = draftToBlock(draft)
    onChange(draft.isNew ? [...intervals, block] : intervals.map(b => b.id === block.id ? block : b))
    setDraft(null)
  }
  function remove() {
    if (!draft) return
    if (!draft.isNew) onChange(intervals.filter(b => b.id !== draft.id))
    setDraft(null)
  }

  const canSave = !!draft && draft.amount.trim() !== ''

  return (
    <View style={{ gap: 7 }}>
      {intervals.map(block =>
        draft && draft.id === block.id ? (
          <BlockEditor key={block.id} theme={theme} draft={draft} patch={patch} onSave={save} onCancel={() => setDraft(null)} onRemove={remove} canSave={canSave} />
        ) : (
          <BlockSummary key={block.id} theme={theme} block={block} onPress={() => setDraft(draftFromBlock(block))} disabled={!!draft} />
        ),
      )}

      {draft?.isNew && (
        <BlockEditor theme={theme} draft={draft} patch={patch} onSave={save} onCancel={() => setDraft(null)} onRemove={remove} canSave={canSave} />
      )}

      {!draft && (
        <TouchableOpacity style={[styles.addBlock, { borderColor: theme.border }]} onPress={() => setDraft(emptyDraft())} activeOpacity={0.7}>
          <Text style={[styles.addBlockText, { color: theme.accent }]}>+ Interval toevoegen</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function BlockSummary({ theme, block, onPress, disabled }: {
  theme: Theme; block: IntervalBlock; onPress: () => void; disabled: boolean
}) {
  const { amount, unit } = intervalAmountUnit(block)
  const title = amount
    ? (block.repeat > 1 ? `${block.repeat}× ${amount} ${unit}` : `${amount} ${unit}`)
    : `Blok ${block.repeat}×`
  const meta = [
    block.pace ? `${block.pace}/km` : null,
    block.recovery ? `${block.recovery} herstel` : null,
  ].filter(Boolean).join(' · ') || 'tik om te bewerken'
  return (
    <TouchableOpacity
      style={[styles.block, styles.blockHead, { backgroundColor: theme.surface, borderColor: theme.border }, disabled && { opacity: 0.5 }]}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.blockTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.blockMeta, { color: theme.muted }]}>{meta}</Text>
      </View>
      <Text style={[styles.blockChevron, { color: theme.muted }]}>›</Text>
    </TouchableOpacity>
  )
}

function BlockEditor({ theme, draft, patch, onSave, onCancel, onRemove, canSave }: {
  theme: Theme; draft: Draft; patch: (p: Partial<Draft>) => void
  onSave: () => void; onCancel: () => void; onRemove: () => void; canSave: boolean
}) {
  return (
    <View style={[styles.block, { backgroundColor: theme.surface2, borderColor: theme.accent }]}>
      <View style={styles.blockBody}>
        {/* 1. Afstand of duur */}
        <FieldLabel>Afstand of duur</FieldLabel>
        <EditorTextField value={draft.amount} onChangeText={v => patch({ amount: v })} placeholder="400" keyboardType="numeric" mono />
        <UnitSelect theme={theme} value={draft.unit} onChange={u => patch({ unit: u })} />

        {/* 2. Pace */}
        <View style={{ marginTop: Spacing.md }}>
          <FieldLabel>Pace</FieldLabel>
          <EditorTextField value={draft.pace} onChangeText={v => patch({ pace: v })} placeholder="4:30" mono />
        </View>

        {/* 3. Herstel */}
        <View style={{ marginTop: Spacing.md }}>
          <FieldLabel>Herstel</FieldLabel>
          <EditorTextField value={draft.recAmount} onChangeText={v => patch({ recAmount: v })} placeholder="90" keyboardType="numeric" mono />
          <UnitSelect theme={theme} value={draft.recUnit} onChange={u => patch({ recUnit: u })} />
        </View>

        {/* 4. Herhalingen */}
        <View style={[styles.repeatRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.repeatTitle, { color: theme.text }]}>Herhalingen</Text>
            <Text style={[styles.repeatSub, { color: theme.muted }]}>hoe vaak dit blok</Text>
          </View>
          <View style={styles.stepGroup}>
            <TouchableOpacity
              style={[styles.stepBtn, { backgroundColor: theme.surface2, borderColor: theme.border }]}
              onPress={() => patch({ repeat: Math.max(1, draft.repeat - 1) })}
              activeOpacity={0.7}
            >
              <Text style={[styles.stepBtnText, { color: theme.text }]}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.repeatVal, { color: theme.text }]}>{draft.repeat}×</Text>
            <TouchableOpacity
              style={[styles.stepBtn, { backgroundColor: theme.surface2, borderColor: theme.border }]}
              onPress={() => patch({ repeat: draft.repeat + 1 })}
              activeOpacity={0.7}
            >
              <Text style={[styles.stepBtnText, { color: theme.text }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Opslaan */}
        <TouchableOpacity
          style={[styles.saveBlock, { backgroundColor: canSave ? theme.accent : theme.surface, borderColor: theme.border, borderWidth: canSave ? 0 : 1 }, !canSave && { opacity: 0.6 }]}
          onPress={onSave}
          disabled={!canSave}
          activeOpacity={0.85}
        >
          <Text style={[styles.saveBlockText, { color: canSave ? theme.accentInk : theme.muted }]}>Interval opslaan</Text>
        </TouchableOpacity>

        <View style={styles.editFooter}>
          <TouchableOpacity onPress={onCancel} activeOpacity={0.7}>
            <Text style={[styles.footerLink, { color: theme.muted }]}>Annuleren</Text>
          </TouchableOpacity>
          {!draft.isNew && (
            <TouchableOpacity onPress={onRemove} activeOpacity={0.7}>
              <Text style={[styles.footerLink, { color: theme.danger }]}>Verwijderen</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  )
}

function UnitSelect({ theme, value, onChange }: {
  theme: Theme; value: IntervalUnit; onChange: (u: IntervalUnit) => void
}) {
  return (
    <View style={styles.unitRow}>
      {UNITS.map(u => {
        const active = value === u
        return (
          <TouchableOpacity
            key={u}
            activeOpacity={0.7}
            onPress={() => onChange(u)}
            style={[styles.unitCell, { borderColor: active ? theme.accent : theme.border, backgroundColor: active ? theme.accentGlow : 'transparent' }]}
          >
            <Text style={[styles.unitText, { color: active ? theme.accent : theme.muted }]}>{u}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  block:       { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  blockHead:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  blockTitle:  { fontFamily: Fonts.displaySemiBold, fontSize: 13.5, letterSpacing: -0.1 },
  blockMeta:   { fontFamily: Fonts.mono, fontSize: 11, marginTop: 2 },
  blockChevron:{ fontFamily: Fonts.display, fontSize: 15 },
  blockBody:   { padding: 13 },

  unitRow:     { flexDirection: 'row', gap: 6, marginTop: 7 },
  unitCell:    { flex: 1, paddingVertical: 7, borderWidth: 1, borderRadius: 8, alignItems: 'center' },
  unitText:    { fontFamily: Fonts.mono, fontSize: 12 },

  repeatRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderRadius: 9, marginTop: Spacing.md },
  repeatTitle: { fontFamily: Fonts.displaySemiBold, fontSize: 13, letterSpacing: -0.1 },
  repeatSub:   { fontFamily: Fonts.display, fontSize: 11.5, marginTop: 1 },
  stepGroup:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn:     { width: 26, height: 26, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontFamily: Fonts.displaySemiBold, fontSize: 16, lineHeight: 18 },
  repeatVal:   { fontFamily: Fonts.displayBold, fontSize: 16, minWidth: 28, textAlign: 'center' },

  saveBlock:   { marginTop: Spacing.md, paddingVertical: 12, borderRadius: Radius.sm, alignItems: 'center' },
  saveBlockText:{ fontFamily: Fonts.displayBold, fontSize: 14, letterSpacing: -0.1 },
  editFooter:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  footerLink:  { fontFamily: Fonts.displaySemiBold, fontSize: 12.5 },

  addBlock:    { marginTop: 3, paddingVertical: 11, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.md, alignItems: 'center' },
  addBlockText:{ fontFamily: Fonts.displaySemiBold, fontSize: 13 },
})
