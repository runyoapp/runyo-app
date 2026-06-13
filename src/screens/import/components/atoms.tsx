// runyo — import-wizard atomen (RN-port van runyo-import-shell/screens-*.jsx).
// Mint Stride-tokens uit useTheme. Geen nep-chrome (ImpStatusBar/FakeKeyboard).

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Fonts } from '@/constants/theme'
import type { Theme } from '@/constants/theme'

const WARN = '#B5912B'
const WARN_BG = 'rgba(181,145,43,0.10)'

export const PHASES = ['bron', 'instellen', 'controleren', 'klaar'] as const

// ── Voortgangsbalk: 4 gesegmenteerde fasen ────────────────────────────────────
export function ProgressBar({ t, phaseIndex }: { t: Theme; phaseIndex: number }) {
  return (
    <View style={s.progressRow}>
      {PHASES.map((ph, i) => (
        <View key={ph} style={[s.progressSeg, { backgroundColor: t.border }]}>
          <View style={[s.progressFill, { backgroundColor: t.accent, width: i <= phaseIndex ? '100%' : '0%' }]} />
        </View>
      ))}
    </View>
  )
}

// ── Bovenbalk: terug · voortgang · sluit ──────────────────────────────────────
export function WizardTopBar({
  t, phaseIndex, showBack, showClose, onBack, onClose,
}: {
  t: Theme; phaseIndex: number; showBack: boolean; showClose: boolean
  onBack?: () => void; onClose?: () => void
}) {
  return (
    <View style={s.topBar}>
      <TouchableOpacity style={s.topBtn} onPress={showBack ? onBack : undefined} disabled={!showBack} activeOpacity={0.6}>
        {showBack ? (
          <View style={[s.backChip, { borderColor: t.border, backgroundColor: t.surface }]}>
            <Text style={[s.backChevron, { color: t.text }]}>‹</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      <ProgressBar t={t} phaseIndex={phaseIndex} />
      <TouchableOpacity style={s.topBtn} onPress={showClose ? onClose : undefined} disabled={!showClose} activeOpacity={0.6}>
        {showClose ? <Text style={[s.closeX, { color: t.muted }]}>✕</Text> : null}
      </TouchableOpacity>
    </View>
  )
}

// ── Titelblok ─────────────────────────────────────────────────────────────────
export function StepHead({ t, title, sub }: { t: Theme; title: string; sub?: string }) {
  return (
    <View style={s.stepHead}>
      <Text style={[s.stepTitle, { color: t.text }]}>{title}</Text>
      {sub ? <Text style={[s.stepSub, { color: t.muted }]}>{sub}</Text> : null}
    </View>
  )
}

// ── Minimale geometrische iconen (geen icon-library) ──────────────────────────
export function Glyph({ type, color }: { type: string; color: string }) {
  if (type === 'pdf' || type === 'file') {
    return (
      <View style={s.glyphBox}>
        <View style={[s.gAbs, { left: 5, top: 3, width: 18, height: 24, borderWidth: 1.6, borderColor: color, borderRadius: 4 }]} />
        {[9, 13, 17].map(y => (
          <View key={y} style={[s.gAbs, { left: 9, top: y, width: 10, height: 1.6, backgroundColor: color, borderRadius: 2 }]} />
        ))}
      </View>
    )
  }
  if (type === 'sheet') {
    return (
      <View style={s.glyphBox}>
        <View style={[s.gAbs, { left: 4, top: 4, width: 22, height: 22, borderWidth: 1.6, borderColor: color, borderRadius: 4 }]} />
        <View style={[s.gAbs, { left: 4, top: 14, width: 22, height: 1.6, backgroundColor: color }]} />
        <View style={[s.gAbs, { left: 14, top: 4, width: 1.6, height: 22, backgroundColor: color }]} />
      </View>
    )
  }
  if (type === 'photo') {
    return (
      <View style={s.glyphBox}>
        <View style={[s.gAbs, { left: 4, top: 5, width: 22, height: 20, borderWidth: 1.6, borderColor: color, borderRadius: 4, overflow: 'hidden' }]}>
          <View style={[s.gAbs, { right: 4, top: 3, width: 5, height: 5, borderRadius: 999, backgroundColor: color }]} />
        </View>
      </View>
    )
  }
  if (type === 'link') {
    return (
      <View style={s.glyphBox}>
        <View style={[s.gAbs, { left: 4, top: 11, width: 13, height: 8, borderWidth: 1.6, borderColor: color, borderRadius: 999 }]} />
        <View style={[s.gAbs, { left: 13, top: 11, width: 13, height: 8, borderWidth: 1.6, borderColor: color, borderRadius: 999 }]} />
      </View>
    )
  }
  return null
}

// ── Grote keuze-tegel (tikken = door) ─────────────────────────────────────────
export function ChoiceTile({
  t, icon, title, sub, primary = false, onPress,
}: {
  t: Theme; icon?: string; title: string; sub: string; primary?: boolean; onPress: () => void
}) {
  const fg = primary ? t.accentInk : t.text
  const subFg = primary ? 'rgba(6,32,25,0.66)' : t.muted
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[s.tile, primary
        ? { backgroundColor: t.accent }
        : { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }]}
    >
      <View style={[s.tileIcon, primary
        ? { backgroundColor: 'rgba(6,32,25,0.10)' }
        : { backgroundColor: t.bg, borderWidth: 1, borderColor: t.border }]}>
        {icon ? <Glyph type={icon} color={fg} /> : null}
      </View>
      <View style={s.flex1}>
        <Text style={[s.tileTitle, { color: fg }]}>{title}</Text>
        <Text style={[s.tileSub, { color: subFg }]}>{sub}</Text>
      </View>
      <Text style={[s.tileChevron, { color: primary ? fg : t.muted }]}>›</Text>
    </TouchableOpacity>
  )
}

// ── Hint-rij (mute/warn/error) ────────────────────────────────────────────────
export function HintRow({
  t, tone = 'mute', children,
}: {
  t: Theme; tone?: 'mute' | 'warn' | 'error'; children: React.ReactNode
}) {
  const col = tone === 'warn' ? WARN : tone === 'error' ? t.danger : t.muted
  const bg = tone === 'warn' ? WARN_BG : tone === 'error' ? t.dangerBg : 'transparent'
  return (
    <View style={[s.hintRow, tone !== 'mute' && { padding: 10, borderRadius: 10, backgroundColor: bg }]}>
      <View style={[s.hintBadge, { borderColor: col }]}>
        <Text style={[s.hintBadgeTxt, { color: col }]}>{tone === 'error' ? '!' : 'i'}</Text>
      </View>
      <Text style={[s.hintText, { color: col }]}>{children}</Text>
    </View>
  )
}

// ── Mail-hint op fout-states ──────────────────────────────────────────────────
export function MailHint({ t }: { t: Theme }) {
  return (
    <View style={s.hintRow}>
      <View style={[s.hintBadge, { borderColor: t.muted }]}>
        <Text style={[s.hintBadgeTxt, { color: t.muted }]}>@</Text>
      </View>
      <Text style={[s.hintText, { color: t.muted }]}>
        Kom je er niet uit? Mail ons via{' '}
        <Text style={{ fontFamily: Fonts.displaySemiBold, color: t.text2 }}>info@runyo.app</Text>
        {' '}- samen komen we er altijd uit.
      </Text>
    </View>
  )
}

// ── Vastgepinde primaire CTA (+ optionele secundaire actie / hint) ────────────
export function PinnedCTA({
  t, label, disabled = false, block = false, secondary, onSecondary, hint, arrow = true, onPress,
}: {
  t: Theme; label: string; disabled?: boolean; block?: boolean
  secondary?: string; onSecondary?: () => void; hint?: string | null; arrow?: boolean; onPress?: () => void
}) {
  const off = disabled || block
  return (
    <View style={[s.ctaWrap, { backgroundColor: t.bg, borderTopColor: t.border }]}>
      {hint ? <Text style={[s.ctaHint, { color: t.muted }]}>{hint}</Text> : null}
      {secondary ? (
        <TouchableOpacity onPress={onSecondary} style={s.ctaSecondaryWrap} activeOpacity={0.6}>
          <Text style={[s.ctaSecondary, { color: t.muted }]}>{secondary}</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        activeOpacity={off ? 1 : 0.85}
        onPress={off ? undefined : onPress}
        disabled={off}
        style={[s.ctaBtn, { backgroundColor: off ? t.border : t.accent }]}
      >
        <Text style={[s.ctaLabel, { color: off ? t.muted : t.accentInk }]}>{label}</Text>
        {arrow ? <Text style={[s.ctaArrow, { color: off ? t.muted : t.accentInk }]}>→</Text> : null}
      </TouchableOpacity>
    </View>
  )
}

// ── Bestandsrij (bevestigen + size-states) ────────────────────────────────────
export function FileRow({
  t, icon = 'pdf', name, status, statusTone = 'mute',
}: {
  t: Theme; icon?: string; name: string; status: string; statusTone?: 'mute' | 'ok' | 'warn' | 'error'
}) {
  const sCol = statusTone === 'ok' ? t.accent : statusTone === 'warn' ? WARN : statusTone === 'error' ? t.danger : t.muted
  return (
    <View style={[s.fileRow, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={[s.fileIcon, { backgroundColor: t.bg, borderColor: t.border }]}>
        <Glyph type={icon} color={t.text} />
      </View>
      <View style={s.flex1}>
        <Text numberOfLines={1} style={[s.fileName, { color: t.text }]}>{name}</Text>
        <Text style={[s.fileStatus, { color: sCol }]}>{statusTone === 'ok' ? '✓ ' : ''}{status}</Text>
      </View>
    </View>
  )
}

// ── Modus-optie (radio-kaart) ─────────────────────────────────────────────────
export function ModeOption({
  t, title, sub, selected, onPress,
}: {
  t: Theme; title: string; sub: string; selected: boolean; onPress: () => void
}) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}
      style={[s.modeOption, { backgroundColor: t.surface, borderColor: selected ? t.accent : t.border }]}>
      <View style={[s.radio, { borderColor: selected ? t.accent : t.border, backgroundColor: selected ? t.accent : 'transparent' }]}>
        {selected ? <Text style={[s.radioCheck, { color: t.accentInk }]}>✓</Text> : null}
      </View>
      <View style={s.flex1}>
        <Text style={[s.modeTitle, { color: t.text }]}>{title}</Text>
        <Text style={[s.modeSub, { color: t.muted }]}>{sub}</Text>
      </View>
    </TouchableOpacity>
  )
}

// ── Dag-selector (7 ronde knoppen ma-zo; index 0=ma … 6=zo) ───────────────────
const DAY_LETTERS = ['M', 'D', 'W', 'D', 'V', 'Z', 'Z']
export function DaySelector({
  t, active, onToggle,
}: {
  t: Theme; active: boolean[]; onToggle: (i: number) => void
}) {
  return (
    <View style={s.daySelector}>
      {DAY_LETTERS.map((d, i) => {
        const on = active[i]
        return (
          <TouchableOpacity key={i} activeOpacity={0.75} onPress={() => onToggle(i)}
            style={[s.dayBtn, on ? { backgroundColor: t.accent } : { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }]}>
            <Text style={[s.dayBtnTxt, { color: on ? t.accentInk : t.muted }]}>{d}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  // progress
  progressRow: { flexDirection: 'row', gap: 5, width: 146 },
  progressSeg: { flex: 1, height: 3.5, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  // top bar
  topBar: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  topBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backChip: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  backChevron: { fontFamily: Fonts.displayMedium, fontSize: 19, marginTop: -2 },
  closeX: { fontFamily: Fonts.display, fontSize: 18 },
  // step head
  stepHead: { paddingHorizontal: 20, paddingTop: 4 },
  stepTitle: { fontFamily: Fonts.displayBold, fontSize: 25, letterSpacing: -0.8, lineHeight: 28 },
  stepSub: { fontFamily: Fonts.display, fontSize: 13.5, marginTop: 8, lineHeight: 20 },
  // glyph
  glyphBox: { width: 30, height: 30 },
  gAbs: { position: 'absolute' },
  // tile
  tile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14 },
  tileIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontFamily: Fonts.displaySemiBold, fontSize: 16.5, letterSpacing: -0.3 },
  tileSub: { fontFamily: Fonts.display, fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  tileChevron: { fontFamily: Fonts.display, fontSize: 22, opacity: 0.8 },
  // hint
  hintRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  hintBadge: { width: 15, height: 15, borderRadius: 999, borderWidth: 1.5, marginTop: 1, alignItems: 'center', justifyContent: 'center' },
  hintBadgeTxt: { fontFamily: Fonts.displayBold, fontSize: 9 },
  hintText: { flex: 1, fontFamily: Fonts.display, fontSize: 12.5, lineHeight: 18 },
  // cta
  ctaWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22, borderTopWidth: 1 },
  ctaHint: { fontFamily: Fonts.display, fontSize: 12.5, textAlign: 'center', marginBottom: 11 },
  ctaSecondaryWrap: { alignItems: 'center', marginBottom: 13 },
  ctaSecondary: { fontFamily: Fonts.displayMedium, fontSize: 13.5 },
  ctaBtn: { height: 52, borderRadius: 8, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaLabel: { fontFamily: Fonts.displayBold, fontSize: 15.5, letterSpacing: -0.2 },
  ctaArrow: { fontSize: 17, fontFamily: Fonts.displaySemiBold },
  // file row
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderRadius: 12, padding: 14 },
  fileIcon: { width: 42, height: 42, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontFamily: Fonts.displaySemiBold, fontSize: 14.5, letterSpacing: -0.2 },
  fileStatus: { fontFamily: Fonts.mono, fontSize: 11.5, marginTop: 4 },
  // mode option
  modeOption: { flexDirection: 'row', gap: 13, alignItems: 'flex-start', borderWidth: 1.5, borderRadius: 14, padding: 15 },
  radio: { width: 22, height: 22, borderRadius: 999, borderWidth: 1.5, marginTop: 1, alignItems: 'center', justifyContent: 'center' },
  radioCheck: { fontSize: 12, fontFamily: Fonts.displayBold },
  modeTitle: { fontFamily: Fonts.displaySemiBold, fontSize: 15.5, letterSpacing: -0.25 },
  modeSub: { fontFamily: Fonts.display, fontSize: 12.5, marginTop: 4, lineHeight: 17 },
  // day selector
  daySelector: { flexDirection: 'row', gap: 7 },
  dayBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayBtnTxt: { fontFamily: Fonts.displaySemiBold, fontSize: 15.5 },
})
