import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import type { ReactNode } from 'react'
import Svg, { Circle, Line, Path } from 'react-native-svg'
import { Fonts } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

// Gedeelde instellingen-atoms volgens het profiel-design.
// Alles via useTheme()-tokens zodat licht/donker blijft werken.

export const CARD_RADIUS = 14

// ── SectionLabel ────────────────────────────────────────────
export function SectionLabel({ children }: { children: ReactNode }) {
  const theme = useTheme()
  return <Text style={[atoms.sectionLabel, { color: theme.muted }]}>{children}</Text>
}

// ── Card ────────────────────────────────────────────────────
export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const theme = useTheme()
  return (
    <View style={[atoms.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      {children}
    </View>
  )
}

export function Divider() {
  const theme = useTheme()
  return <View style={{ height: 1, backgroundColor: theme.border }} />
}

// ── Toggle (custom, matcht design) ──────────────────────────
export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const theme = useTheme()
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.8}
      style={[atoms.toggle, { backgroundColor: on ? theme.accent : theme.border, justifyContent: on ? 'flex-end' : 'flex-start' }]}
    >
      <View style={atoms.toggleKnob} />
    </TouchableOpacity>
  )
}

// ── Bewerkbare tijd-chip ────────────────────────────────────
export function TimeChip({ time, onChange, onRemove }: {
  time: string
  onChange: (v: string) => void
  onRemove: () => void
}) {
  const theme = useTheme()
  return (
    <View style={[atoms.chip, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
      <TextInput
        value={time}
        onChangeText={onChange}
        placeholder="09:00"
        placeholderTextColor={theme.faint}
        keyboardType="numbers-and-punctuation"
        style={[atoms.chipInput, { color: theme.text }]}
      />
      <TouchableOpacity onPress={onRemove} hitSlop={6} style={atoms.chipRemove}>
        <Text style={[atoms.chipRemoveText, { color: theme.muted }]}>×</Text>
      </TouchableOpacity>
    </View>
  )
}

export function AddTimeButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme()
  return (
    <TouchableOpacity onPress={onPress} style={atoms.addTime} activeOpacity={0.7}>
      <Text style={[atoms.addTimeText, { color: theme.accent }]}>
        <Text style={atoms.addTimePlus}>+ </Text>Tijd toevoegen
      </Text>
    </TouchableOpacity>
  )
}

// ── ActionRow (import / leeg schema / admin) ────────────────
export function ActionRow({ icon, iconBg, iconColor, title, badge, sub, chevron = true, onPress }: {
  icon?: ReactNode
  iconBg?: string
  iconColor?: string
  title: string
  badge?: string
  sub?: string
  chevron?: boolean
  onPress?: () => void
}) {
  const theme = useTheme()
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} style={atoms.actionRow}>
      {icon != null && (
        <View style={[atoms.actionIcon, { backgroundColor: iconBg ?? theme.surface2 }]}>
          {typeof icon === 'string'
            ? <Text style={[atoms.actionIconText, { color: iconColor ?? theme.text }]}>{icon}</Text>
            : icon}
        </View>
      )}
      <View style={atoms.actionBody}>
        <View style={atoms.actionTitleRow}>
          <Text style={[atoms.actionTitle, { color: theme.text }]}>{title}</Text>
          {badge != null && (
            <View style={[atoms.badge, { backgroundColor: theme.accent }]}>
              <Text style={[atoms.badgeText, { color: theme.accentInk }]}>{badge}</Text>
            </View>
          )}
        </View>
        {sub != null && <Text style={[atoms.actionSub, { color: theme.muted }]}>{sub}</Text>}
      </View>
      {chevron && <Text style={[atoms.chevron, { color: theme.muted }]}>›</Text>}
    </TouchableOpacity>
  )
}

// ── Segmented pills (taal + thema) ──────────────────────────
export function SegTrack({ children }: { children: ReactNode }) {
  const theme = useTheme()
  return <View style={[atoms.segTrack, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>
}

export function SegCell({ active, onPress, children }: { active: boolean; onPress: () => void; children: ReactNode }) {
  const theme = useTheme()
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[atoms.segCell, active && { backgroundColor: theme.accent }]}
    >
      {children}
    </TouchableOpacity>
  )
}

export function SunGlyph({ active }: { active: boolean }) {
  const theme = useTheme()
  const c = active ? theme.accentInk : theme.muted
  const rays = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx={12} cy={12} r={4.2} fill={c} stroke={c} />
      {rays.map(a => {
        const r = (a * Math.PI) / 180
        return (
          <Line
            key={a}
            x1={12 + Math.cos(r) * 7.4} y1={12 + Math.sin(r) * 7.4}
            x2={12 + Math.cos(r) * 9.4} y2={12 + Math.sin(r) * 9.4}
          />
        )
      })}
    </Svg>
  )
}

export function MoonGlyph({ active }: { active: boolean }) {
  const theme = useTheme()
  const c = active ? theme.accentInk : theme.muted
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill={c} />
    </Svg>
  )
}

const atoms = StyleSheet.create({
  sectionLabel: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', paddingHorizontal: 4, paddingBottom: 9 },
  card:         { borderWidth: 1, borderRadius: CARD_RADIUS, overflow: 'hidden' },

  toggle:       { width: 48, height: 28, borderRadius: 999, padding: 3, flexDirection: 'row', alignItems: 'center' },
  toggleKnob:   { width: 22, height: 22, borderRadius: 999, backgroundColor: '#fff' },

  chip:         { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingLeft: 13, paddingRight: 7, height: 40 },
  chipInput:    { fontFamily: Fonts.mono, fontSize: 15, letterSpacing: 0.3, padding: 0, minWidth: 46, textAlign: 'left' },
  chipRemove:   { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  chipRemoveText:{ fontFamily: Fonts.display, fontSize: 16, lineHeight: 18 },

  addTime:      { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 2 },
  addTimeText:  { fontFamily: Fonts.displaySemiBold, fontSize: 13.5 },
  addTimePlus:  { fontSize: 16 },

  actionRow:    { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 },
  actionIcon:   { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionIconText:{ fontFamily: Fonts.displayBold, fontSize: 20 },
  actionBody:   { flex: 1, minWidth: 0 },
  actionTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actionTitle:  { fontFamily: Fonts.displayBold, fontSize: 14.5, letterSpacing: -0.1 },
  actionSub:    { fontFamily: Fonts.display, fontSize: 12.5, marginTop: 2 },
  badge:        { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText:    { fontFamily: Fonts.monoMedium, fontSize: 9.5, letterSpacing: 0.2 },
  chevron:      { fontFamily: Fonts.display, fontSize: 18 },

  segTrack:     { flexDirection: 'row', gap: 2, padding: 3, height: 34, borderRadius: 999, borderWidth: 1 },
  segCell:      { minWidth: 34, height: 28, paddingHorizontal: 10, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
})
