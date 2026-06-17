import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { useTheme } from '@/hooks/useTheme'
import { Fonts, Radius } from '@/constants/theme'
import { MONTHS_NL, fromDateString, raceCountdown } from '@/utils/date'
import { derivePace } from '@/utils/raceProgress'
import type { Activity } from '@/types/activity'

type Props = {
  race: Activity
  progress: number      // 0..1 blokvoortgang
  onPress?: () => void
}

const RING = 104
const STROKE = 8
const R = RING / 2 - 6
const CIRC = 2 * Math.PI * R

function fmtKm(km: number): string {
  return km % 1 === 0 ? String(km) : km.toFixed(1).replace('.', ',')
}

function fmtDate(datum: string): string {
  const d = fromDateString(datum)
  return `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
}

// Eerstvolgende race: ring = blokvoortgang, midden = dagen-countdown,
// rechts tier-A badge "hoofddoel" + naam + datum·afstand + doel-pill.
export function RaceHero({ race, progress, onPress }: Props) {
  const theme = useTheme()
  const pace  = derivePace(race.goalTime, race.km)
  const dash  = CIRC * Math.min(1, Math.max(0, progress))
  // Slimme aftelling: dagen < 3 weken, daarna weken, daarna maanden ('vandaag' bij 0).
  const cd    = raceCountdown(race.datum)
  const big   = cd.val.length >= 3 || Number.isNaN(Number(cd.val))
  // Tier volgt de echte hoofddoel-vlag, zodat hero en seizoens-tijdlijn matchen.
  const isMain = !!race.isMainGoal

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface, borderColor: `${theme.accent}66` }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
    >
      <View style={styles.ringBox}>
        <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
          <Circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={theme.border} strokeWidth={STROKE} />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            fill="none"
            stroke={theme.accent}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRC}`}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text
            style={[styles.days, { color: theme.text }, big && styles.daysBig]}
            numberOfLines={1}
          >{cd.val}</Text>
          <Text style={[styles.daysUnit, { color: theme.muted }]} numberOfLines={1}>{cd.unit}</Text>
        </View>
      </View>

      <View style={styles.info}>
        <View style={styles.tierRow}>
          <View style={[styles.tierBadge, {
            backgroundColor: isMain ? theme.accent : theme.surface2,
            borderWidth: isMain ? 0 : 1, borderColor: theme.border,
          }]}>
            <Text style={[styles.tierBadgeText, { color: isMain ? '#fff' : theme.text2 }]}>{isMain ? 'A' : 'B'}</Text>
          </View>
          <Text style={[styles.kicker, { color: isMain ? theme.accent : theme.muted }]}>
            {isMain ? 'hoofddoel' : 'eerstvolgende race'}
          </Text>
        </View>

        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {race.titel || fmtDate(race.datum)}
        </Text>
        <Text style={[styles.meta, { color: theme.muted }]}>
          {fmtDate(race.datum)}{race.km != null ? ` · ${fmtKm(race.km)} km` : ''}
        </Text>

        {race.goalTime && (
          <View style={[styles.goalPill, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
            <View style={[styles.goalDot, { backgroundColor: theme.accent }]} />
            <Text style={[styles.goalText, { color: theme.text2 }]} numberOfLines={1}>
              doel {race.goalTime}{pace ? ` · ${pace}/km` : ''}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card:        { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: Radius.lg + 4, borderWidth: 1 },
  ringBox:     { width: RING, height: RING, flexShrink: 0 },
  ringCenter:  { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  days:        { fontFamily: Fonts.displayBold, fontSize: 34, lineHeight: 36, letterSpacing: -1.6 },
  daysBig:     { fontSize: 20, lineHeight: 24, letterSpacing: -0.8 },  // langere waarden ("vandaag", weken/maanden-getal) passend in de ring
  daysUnit:    { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 2 },
  info:        { flex: 1, minWidth: 0 },
  tierRow:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tierBadge:   { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tierBadgeText: { fontFamily: Fonts.displayBold, fontSize: 9, color: '#fff' },
  kicker:      { fontFamily: Fonts.mono, fontSize: 9.5, letterSpacing: 0.6, textTransform: 'uppercase' },
  name:        { fontFamily: Fonts.displaySemiBold, fontSize: 18, letterSpacing: -0.45, marginTop: 7 },
  meta:        { fontFamily: Fonts.display, fontSize: 12.5, marginTop: 2 },
  goalPill:    { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginTop: 9 },
  goalDot:     { width: 5, height: 5, borderRadius: 2.5 },
  goalText:    { fontFamily: Fonts.mono, fontSize: 10.5 },
})
