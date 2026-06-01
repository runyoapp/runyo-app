// Gedeelde editor-bouwstenen voor de bewerk-modals (activiteit / race / toevoegen).
// Herontworpen in Mint Stride op basis van de Claude design-handoff:
//   - compacte velden i.p.v. grote lege bakken
//   - vriendelijke datum i.p.v. rauwe ISO-string
//   - afstand als hero-stepper met snelkeuze
//   - type-chips met categorie-dot die netjes wrappen
//   - altijd-bereikbare opslaan-balk (zie ModalSheet `footer`)
//
// Alle componenten lezen kleuren/typografie uit de design tokens via useTheme().

import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { ActivityColors, Fonts, Spacing, Radius, type Theme } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { fromDateString, DAYS_NL, MONTHS_NL } from '@/utils/date'

// Categorie-dot per type — werk krijgt geen dot (neutraal).
export function activityDot(type: string): string | null {
  if (type === 'work') return null
  return (ActivityColors as Record<string, { text: string }>)[type]?.text ?? null
}

// ─────────────────────────────────────────────────────────
// Veldlabel
// ─────────────────────────────────────────────────────────

export function FieldLabel({ children, hint }: { children: string; hint?: string }) {
  const t = useTheme()
  return (
    <View style={s.labelRow}>
      <Text style={[s.label, { color: t.text2 }]}>{children}</Text>
      {hint && <Text style={[s.labelHint, { color: t.muted }]}>{hint}</Text>}
    </View>
  )
}

// ─────────────────────────────────────────────────────────
// Tekstvelden
// ─────────────────────────────────────────────────────────

type TextFieldProps = {
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  mono?: boolean
  big?: boolean
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType']
}

export function EditorTextField({ value, onChangeText, placeholder, mono, big, keyboardType }: TextFieldProps) {
  const t = useTheme()
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.faint}
      keyboardType={keyboardType}
      style={[
        s.field,
        {
          backgroundColor: t.surface,
          borderColor: t.border,
          color: t.text,
          fontFamily: mono ? Fonts.mono : Fonts.displaySemiBold,
          fontSize: big ? 17 : 15,
          paddingVertical: big ? 14 : 13,
        },
      ]}
    />
  )
}

export function EditorTextArea({ value, onChangeText, placeholder }: TextFieldProps) {
  const t = useTheme()
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.faint}
      multiline
      numberOfLines={3}
      textAlignVertical="top"
      style={[s.field, s.textarea, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
    />
  )
}

// ─────────────────────────────────────────────────────────
// Chip-selector — wrapt netjes, optionele categorie-dot
// ─────────────────────────────────────────────────────────

export type ChipOption = { key: string; label: string; dot?: string | null }

export function ChipSelect({ options, value, onChange }: {
  options: ChipOption[]
  value: string
  onChange: (key: string) => void
}) {
  const t = useTheme()
  return (
    <View style={s.chipWrap}>
      {options.map(opt => {
        const active = opt.key === value
        return (
          <TouchableOpacity
            key={opt.key}
            activeOpacity={0.8}
            onPress={() => onChange(opt.key)}
            style={[
              s.chip,
              { backgroundColor: active ? t.text : t.surface, borderColor: active ? t.text : t.border },
            ]}
          >
            {opt.dot && (
              <View
                style={[
                  s.chipDot,
                  { backgroundColor: opt.dot },
                  active && { borderWidth: 1.5, borderColor: t.bg },
                ]}
              />
            )}
            <Text style={[s.chipText, { color: active ? t.bg : t.text }]}>{opt.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ─────────────────────────────────────────────────────────
// Vriendelijk datumveld — toont "do 13 jun 2026", tikbaar om te bewerken
// ─────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = fromDateString(iso)
  if (isNaN(d.getTime())) return iso
  return `${DAYS_NL[(d.getDay() + 6) % 7].toLowerCase()} ${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${d.getFullYear()}`
}

export function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTheme()
  const [editing, setEditing] = useState(false)
  const day = (() => {
    const d = fromDateString(value)
    return isNaN(d.getTime()) ? '' : String(d.getDate())
  })()

  if (editing) {
    return (
      <TextInput
        autoFocus
        value={value}
        onChangeText={onChange}
        onBlur={() => setEditing(false)}
        onSubmitEditing={() => setEditing(false)}
        placeholder="jjjj-mm-dd"
        placeholderTextColor={t.faint}
        keyboardType="numbers-and-punctuation"
        style={[s.field, { backgroundColor: t.surface, borderColor: t.accent, color: t.text, fontFamily: Fonts.mono, fontSize: 15 }]}
      />
    )
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => setEditing(true)}
      style={[s.dateRow, { backgroundColor: t.surface, borderColor: t.border }]}
    >
      <View style={[s.dateIcon, { borderColor: t.border }]}>
        <View style={[s.dateIconTop, { backgroundColor: t.text }]} />
        <View style={s.dateIconBody}>
          <Text style={[s.dateIconDay, { color: t.text }]}>{day}</Text>
        </View>
      </View>
      <Text style={[s.dateText, { color: t.text }]}>{fmtDate(value)}</Text>
      <Text style={[s.dateChevron, { color: t.muted }]}>›</Text>
    </TouchableOpacity>
  )
}

// ─────────────────────────────────────────────────────────
// Hero afstand-stepper met snelkeuze
// ─────────────────────────────────────────────────────────

const round1 = (v: number) => Math.max(0, Math.round(v * 10) / 10)

export function DistanceStepper({ value, onChange, presets = [5, 10, 16, 21] }: {
  value: number
  onChange: (v: number) => void
  presets?: number[]
}) {
  const t = useTheme()
  return (
    <View>
      <View style={s.stepHeroRow}>
        <View style={s.stepHeroValue}>
          <Text style={[s.stepNumber, { color: t.text }]}>{value}</Text>
          <Text style={[s.stepUnit, { color: t.muted }]}>km</Text>
        </View>
        <View style={s.stepBtns}>
          <StepBtn label="−" onPress={() => onChange(round1(value - 1))} />
          <StepBtn label="+" onPress={() => onChange(round1(value + 1))} />
        </View>
      </View>
      <View style={s.presetRow}>
        {presets.map(km => {
          const active = km === value
          return (
            <TouchableOpacity
              key={km}
              activeOpacity={0.8}
              onPress={() => onChange(km)}
              style={[
                s.preset,
                {
                  backgroundColor: active ? t.accentGlow : t.surface,
                  borderColor: active ? t.accent : t.border,
                },
              ]}
            >
              <Text style={[s.presetText, { color: active ? t.text : t.text2 }]}>
                {km}<Text style={[s.presetUnit, { color: t.muted }]}> km</Text>
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

function StepBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme()
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}
      style={[s.stepBtn, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Text style={[s.stepBtnText, { color: t.text }]}>{label}</Text>
    </TouchableOpacity>
  )
}

// ─────────────────────────────────────────────────────────
// Toggle switch
// ─────────────────────────────────────────────────────────

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme()
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => onChange(!on)}
      style={[s.toggle, { backgroundColor: on ? t.accent : t.border }]}>
      <View style={[s.toggleThumb, { left: on ? 21 : 3 }]} />
    </TouchableOpacity>
  )
}

// ─────────────────────────────────────────────────────────
// Sticky opslaan-balk (geef door aan ModalSheet `footer`)
// ─────────────────────────────────────────────────────────

export function SaveBar({ label = 'Opslaan', onSave, onCancel, onDelete, saving }: {
  label?: string
  onSave: () => void
  onCancel?: () => void
  onDelete?: () => void
  saving?: boolean
}) {
  const t = useTheme()
  return (
    <View style={s.saveBar}>
      <TouchableOpacity activeOpacity={0.85} onPress={onSave} disabled={saving}
        style={[s.saveBtn, { backgroundColor: t.accent }, saving && { opacity: 0.5 }]}>
        <Text style={[s.saveBtnText, { color: t.accentInk }]}>{saving ? 'Opslaan…' : label}</Text>
      </TouchableOpacity>
      {(onCancel || onDelete) && (
        <View style={s.saveSubRow}>
          {onCancel && (
            <TouchableOpacity onPress={onCancel} style={s.saveSubBtn}>
              <Text style={[s.saveSubText, { color: t.muted }]}>Annuleren</Text>
            </TouchableOpacity>
          )}
          {onCancel && onDelete && <View style={[s.saveDivider, { backgroundColor: t.border }]} />}
          {onDelete && (
            <TouchableOpacity onPress={onDelete} style={s.saveSubBtn}>
              <Text style={[s.saveSubText, { color: t.danger }]}>Verwijderen</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

// ─────────────────────────────────────────────────────────
// Rustdag-kaart (type === rest)
// ─────────────────────────────────────────────────────────

export function RestCard({ note }: { note: string }) {
  const t = useTheme()
  return (
    <View style={[s.restCard, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={[s.restBar, { backgroundColor: t.faint }]} />
      <View style={{ flex: 1 }}>
        <Text style={[s.restTitle, { color: t.text }]}>Rustdag</Text>
        <Text style={[s.restNote, { color: t.muted }]}>{note}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  labelRow:    { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginBottom: Spacing.sm, paddingHorizontal: 2 },
  label:       { fontFamily: Fonts.displaySemiBold, fontSize: 12, letterSpacing: -0.1 },
  labelHint:   { fontFamily: Fonts.displayMedium, fontSize: 11.5 },

  field:       { width: '100%', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, letterSpacing: -0.15 },
  textarea:    { minHeight: 80, paddingVertical: 13, fontFamily: Fonts.display, fontSize: 14.5, lineHeight: 21 },

  chipWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1 },
  chipDot:     { width: 7, height: 7, borderRadius: 999 },
  chipText:    { fontFamily: Fonts.displaySemiBold, fontSize: 13, letterSpacing: -0.15 },

  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderRadius: Radius.md },
  dateIcon:    { width: 30, height: 30, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  dateIconTop: { height: 8 },
  dateIconBody:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  dateIconDay: { fontFamily: Fonts.displayBold, fontSize: 12, lineHeight: 14 },
  dateText:    { flex: 1, fontFamily: Fonts.displaySemiBold, fontSize: 15, letterSpacing: -0.15 },
  dateChevron: { fontFamily: Fonts.display, fontSize: 18 },

  stepHeroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, paddingHorizontal: 2, paddingTop: 4, paddingBottom: 14 },
  stepHeroValue:{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  stepNumber:  { fontFamily: Fonts.displayBold, fontSize: 56, letterSpacing: -2, lineHeight: 56 },
  stepUnit:    { fontFamily: Fonts.displayMedium, fontSize: 18 },
  stepBtns:    { flexDirection: 'row', gap: 8 },
  stepBtn:     { width: 42, height: 42, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontFamily: Fonts.displaySemiBold, fontSize: 22, lineHeight: 26 },
  presetRow:   { flexDirection: 'row', gap: 7 },
  preset:      { flex: 1, paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center' },
  presetText:  { fontFamily: Fonts.displaySemiBold, fontSize: 13, letterSpacing: -0.15 },
  presetUnit:  { fontFamily: Fonts.displayMedium, fontSize: 10.5 },

  toggle:      { width: 46, height: 28, borderRadius: 999 },
  toggleThumb: { position: 'absolute', top: 3, width: 22, height: 22, borderRadius: 999, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },

  saveBar:     { gap: 10 },
  saveBtn:     { width: '100%', paddingVertical: 15, borderRadius: Radius.lg, alignItems: 'center' },
  saveBtnText: { fontFamily: Fonts.displayBold, fontSize: 16, letterSpacing: -0.15 },
  saveSubRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  saveSubBtn:  { paddingHorizontal: 8, paddingVertical: 4 },
  saveSubText: { fontFamily: Fonts.displaySemiBold, fontSize: 13.5 },
  saveDivider: { width: 1, height: 14 },

  restCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1, borderRadius: Radius.lg },
  restBar:     { width: 4, alignSelf: 'stretch', borderRadius: 999 },
  restTitle:   { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.15 },
  restNote:    { fontFamily: Fonts.display, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
})

export type { Theme }
