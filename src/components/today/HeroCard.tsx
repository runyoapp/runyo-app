import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { ActivityColors } from '@/constants/theme'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { TYPE_DISPLAY } from '@/constants/activities'
import type { Activity, ActivityType } from '@/types/activity'

type Props = {
  activity: Activity
  onPress: () => void
  onFeedbackPress: () => void
}

// Canonical hero card — spec: runyo-pwa.jsx ScreenVandaag
// cat-tag → km display → progress line → 3-metric row → CTA
export function HeroCard({ activity, onPress, onFeedbackPress }: Props) {
  const theme  = useTheme()
  const colors = ActivityColors[activity.type as ActivityType] ?? ActivityColors.run
  const label  = TYPE_DISPLAY[activity.type as ActivityType]?.nl ?? activity.type
  const hasFb  = !!activity.feedback
  const isRun  = activity.type === 'run'
  const today  = new Date().toISOString().split('T')[0]
  const isPastOrToday = activity.datum <= today

  const detail    = activity.detail ?? ''
  const paceMatch = detail.match(/(\d+:\d+)[–-]?(\d+:\d+)?\/km/)
  const hrMatch   = detail.match(/<?\s*(\d+)\s*bpm/i) ?? detail.match(/HR\s*<?(\d+)/i)
  const duurMatch = detail.match(/(\d+)\s*(?:min|')/i)

  // Always show 3 metric slots (pace / hr / duur) — blank if not available
  const metrics = [
    { key: 'pace',  val: paceMatch ? paceMatch[0].replace('/km','').trim() + '/km' : null },
    { key: 'hr',    val: hrMatch   ? `${hrMatch[1]} bpm` : null },
    { key: 'duur',  val: duurMatch ? `${duurMatch[1]}′`  : null },
  ].filter(m => m.val)

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Cat tag: dot + label */}
      <View style={styles.catTag}>
        <View style={[styles.dot, { backgroundColor: colors.text }]} />
        <Text style={[styles.catLabel, { color: theme.text2 }]}>
          {label}{activity.titel ? ` · ${activity.titel}` : ''}
        </Text>
      </View>

      {/* Hero number — Sora 800 / 56px */}
      {activity.km != null && (
        <Text style={[styles.heroNum, { color: theme.text }]}>
          {activity.km}<Text style={[styles.heroUnit, { color: theme.muted }]}> km</Text>
        </Text>
      )}
      {activity.km == null && duurMatch && (
        <Text style={[styles.heroNum, { color: theme.text }]}>
          {duurMatch[1]}<Text style={[styles.heroUnit, { color: theme.muted }]}> min</Text>
        </Text>
      )}

      {/* Subtitle */}
      {!!activity.titel && activity.km != null && (
        <Text style={[styles.subtitle, { color: theme.text2 }]} numberOfLines={1}>
          {activity.titel}
        </Text>
      )}

      {/* Progress line: 3px, mute → mint — spec: brand.md §7 Workout card */}
      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.progressFill, { backgroundColor: theme.accent }]} />
      </View>

      {/* 3-metric row: pace / hr / duur — Sora 700 / 19px */}
      {metrics.length > 0 && (
        <View style={styles.metrics}>
          {metrics.map(m => (
            <View key={m.key} style={styles.metric}>
              <Text style={[styles.metricLabel, { color: theme.muted }]}>{m.key}</Text>
              <Text style={[styles.metricVal, { color: theme.text }]}>{m.val}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Detail */}
      {!!detail && metrics.length === 0 && (
        <Text style={[styles.detail, { color: theme.muted }]} numberOfLines={3}>{detail}</Text>
      )}

      {/* Full-width CTA — mint bg, accent-ink text, Sora 700 / 15px */}
      {isRun && isPastOrToday && (
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: hasFb ? theme.accentGlow : theme.accent }]}
          onPress={onFeedbackPress}
        >
          <Text style={[styles.ctaText, { color: hasFb ? theme.accent : theme.accentInk }]}>
            {hasFb ? 'Beoordeling bewerken' : 'Beoordeel run'}
          </Text>
          <Text style={[styles.ctaArrow, { color: hasFb ? theme.accent : theme.accentInk }]}>→</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

export function RestCard() {
  const theme = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.catTag}>
        <View style={[styles.dot, { backgroundColor: theme.border }]} />
        <Text style={[styles.catLabel, { color: theme.muted }]}>Rust</Text>
      </View>
      <Text style={[styles.heroNum, { color: theme.text, fontSize: 40 }]}>😴</Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>Herstel is ook training.</Text>
    </View>
  )
}

export function NoSchemaCard({ isSignedIn, onConnect, onLogin }: { isSignedIn: boolean; onConnect: () => void; onLogin?: () => void }) {
  const theme = useTheme()
  return (
    <View style={[styles.noSchema, { paddingHorizontal: Spacing.xl }]}>
      <Text style={[styles.noSchemaTitle, { color: theme.text }]}>
        {isSignedIn ? 'Geen schema gekoppeld' : 'Breng je schema mee'}
      </Text>
      <Text style={[styles.noSchemaSub, { color: theme.muted }]}>
        {isSignedIn
          ? 'Koppel jouw trainingsschema en ontvang dagelijks wat er op het programma staat.'
          : 'Log in en importeer je trainingsschema om elke dag te zien wat er op het programma staat.'}
      </Text>
      {!isSignedIn && onLogin && (
        <TouchableOpacity style={[styles.cta, { backgroundColor: theme.accent }]} onPress={onLogin}>
          <Text style={[styles.ctaText, { color: theme.accentInk }]}>Inloggen</Text>
        </TouchableOpacity>
      )}
      {isSignedIn && (
        <TouchableOpacity style={[styles.cta, { backgroundColor: theme.accent }]} onPress={onConnect}>
          <Text style={[styles.ctaText, { color: theme.accentInk }]}>Schema koppelen</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card:           { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.sm },
  catTag:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:            { width: 8, height: 8, borderRadius: 4 },
  catLabel:       { fontFamily: Fonts.displayMedium, fontSize: 12, letterSpacing: -0.1 },
  heroNum:        { fontFamily: Fonts.displayBold, fontSize: 56, letterSpacing: -2.5, lineHeight: 60 },
  heroUnit:       { fontFamily: Fonts.displayMedium, fontSize: 20 },
  subtitle:       { fontFamily: Fonts.displaySemiBold, fontSize: 18, letterSpacing: -0.3 },
  progressTrack:  { height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill:   { width: '36%', height: '100%', borderRadius: 2 },
  metrics:        { flexDirection: 'row', gap: Spacing.xl },
  metric:         { gap: 2 },
  metricLabel:    { fontFamily: Fonts.display, fontSize: 12, letterSpacing: -0.1 },
  metricVal:      { fontFamily: Fonts.displayBold, fontSize: 19, letterSpacing: -0.4 },
  detail:         { fontFamily: Fonts.display, fontSize: 14, lineHeight: 20 },
  cta:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: Radius.sm, paddingVertical: 14, paddingHorizontal: Spacing.lg, marginTop: Spacing.sm },
  ctaText:        { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.2 },
  ctaArrow:       { fontFamily: Fonts.displayBold, fontSize: 15 },
  noSchema:       { paddingVertical: Spacing.xl, gap: Spacing.md },
  noSchemaTitle:  { fontFamily: Fonts.displayBold, fontSize: 24, letterSpacing: -0.5 },
  noSchemaSub:    { fontFamily: Fonts.display, fontSize: 14, lineHeight: 22 },
})
