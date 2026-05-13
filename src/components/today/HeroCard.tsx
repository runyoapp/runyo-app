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

export function HeroCard({ activity, onPress, onFeedbackPress }: Props) {
  const theme    = useTheme()
  const colors  = ActivityColors[activity.type as ActivityType] ?? ActivityColors.run
  const label    = TYPE_DISPLAY[activity.type as ActivityType]?.nl ?? activity.type
  const hasFb    = !!activity.feedback
  const isRun    = activity.type === 'run'
  const today    = new Date().toISOString().split('T')[0]
  const isPastOrToday = activity.datum <= today

  // Parse pace/HR/duration from detail string
  const detail     = activity.detail ?? ''
  const paceMatch  = detail.match(/(\d+:\d+)[–-]?(\d+:\d+)?\/km/)
  const hrMatch    = detail.match(/<?\s*(\d+)\s*bpm/i) ?? detail.match(/HR\s*<?(\d+)/i)
  const duurMatch  = detail.match(/(\d+)\s*(?:min|')/i)
  const hasStats   = paceMatch ?? hrMatch ?? duurMatch

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: theme.surface }]} onPress={onPress} activeOpacity={0.85}>
      {/* Type badge */}
      <View style={styles.badge}>
        <View style={[styles.dot, { backgroundColor: colors.text }]} />
        <Text style={styles.badgeText}>
          {label}{activity.titel ? ` · ${activity.titel}` : ''}
        </Text>
      </View>

      {/* Big number — km or duration */}
      {activity.km != null && (
        <View style={styles.kmRow}>
          <Text style={[styles.km, !isRun && styles.kmSmall]}>{activity.km}</Text>
          <Text style={styles.kmUnit}> km</Text>
        </View>
      )}
      {!activity.km && duurMatch && (
        <View style={styles.kmRow}>
          <Text style={styles.km}>{duurMatch[1]}</Text>
          <Text style={styles.kmUnit}> min</Text>
        </View>
      )}

      {/* Pace / HR stats row */}
      {hasStats && (
        <View style={styles.statsRow}>
          {paceMatch && (
            <View style={styles.stat}>
              <Text style={styles.statLabel}>pace</Text>
              <Text style={styles.statVal}>{paceMatch[0]}</Text>
            </View>
          )}
          {hrMatch && (
            <View style={styles.stat}>
              <Text style={styles.statLabel}>hr</Text>
              <Text style={styles.statVal}>&lt;{hrMatch[1]} bpm</Text>
            </View>
          )}
          {duurMatch && !activity.km && (
            <View style={styles.stat}>
              <Text style={styles.statLabel}>duur</Text>
              <Text style={styles.statVal}>{duurMatch[1]}′</Text>
            </View>
          )}
        </View>
      )}

      {/* Detail text */}
      {!!detail && <Text style={styles.detail} numberOfLines={3}>{detail}</Text>}

      {/* Feedback CTA — only for past/today runs */}
      {isRun && isPastOrToday && (
        <TouchableOpacity
          style={[styles.cta, hasFb && styles.ctaSecondary]}
          onPress={e => { onFeedbackPress() }}
        >
          <Text style={[styles.ctaText, hasFb && styles.ctaTextSecondary]}>
            {hasFb ? 'Beoordeling bewerken →' : 'Beoordeel run →'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

export function RestCard() {
  const theme = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.restInner}>
        <Text style={styles.restEmoji}>😴</Text>
        <View>
          <Text style={styles.restTitle}>Rustdag</Text>
          <Text style={styles.restSub}>Herstel is ook training.</Text>
        </View>
      </View>
    </View>
  )
}

export function NoSchemaCard({ isSignedIn, onConnect }: { isSignedIn: boolean; onConnect: () => void }) {
  return (
    <View style={styles.noSchemaContainer}>
      <Text style={styles.noSchemaTitle}>
        {isSignedIn ? 'Geen schema gekoppeld' : 'Breng je schema mee'}
      </Text>
      <Text style={styles.noSchemaSub}>
        {isSignedIn
          ? 'Koppel jouw trainingsschema en ontvang dagelijks wat er op het programma staat.'
          : 'Importeer je trainingsschema en ontvang elke dag wat er op het programma staat.'}
      </Text>
      <TouchableOpacity style={styles.connectBtn} onPress={onConnect}>
        <Text style={styles.connectBtnText}>
          {isSignedIn ? 'Schema koppelen' : 'Inloggen met Google'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LightTheme.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontFamily: Fonts.displayMedium,
    fontSize: 13,
    color: LightTheme.text2,
  },
  kmRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.sm,
  },
  km: {
    fontFamily: Fonts.displayBold,
    fontSize: 64,
    color: LightTheme.text,
    letterSpacing: -2,
    lineHeight: 68,
  },
  kmSmall: { fontSize: 48 },
  kmUnit: {
    fontFamily: Fonts.displayMedium,
    fontSize: 20,
    color: LightTheme.muted,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  stat: { gap: 2 },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: LightTheme.faint,
    textTransform: 'uppercase',
  },
  statVal: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    color: LightTheme.text,
  },
  detail: {
    fontFamily: Fonts.display,
    fontSize: 14,
    color: LightTheme.muted,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  cta: {
    backgroundColor: LightTheme.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  ctaSecondary: {
    backgroundColor: LightTheme.accentGlow,
  },
  ctaText: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 13,
    color: '#fff',
  },
  ctaTextSecondary: {
    color: LightTheme.accent,
  },
  restInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  restEmoji: { fontSize: 40 },
  restTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    color: LightTheme.text,
  },
  restSub: {
    fontFamily: Fonts.display,
    fontSize: 13,
    color: LightTheme.muted,
    marginTop: 2,
  },
  noSchemaContainer: {
    padding: Spacing.xl,
    marginHorizontal: Spacing.lg,
  },
  noSchemaTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 24,
    color: LightTheme.text,
    letterSpacing: -0.5,
    marginBottom: Spacing.sm,
  },
  noSchemaSub: {
    fontFamily: Fonts.display,
    fontSize: 14,
    color: LightTheme.muted,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  connectBtn: {
    backgroundColor: LightTheme.accent,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  connectBtnText: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 15,
    color: '#fff',
  },
})
