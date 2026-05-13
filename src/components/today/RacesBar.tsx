import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import type { Activity } from '@/types/activity'

type Props = {
  activities: Activity[]
  onRacePress: (datum: string) => void
}

function countdown(dateStr: string): { val: string; unit: string } {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const race  = new Date(dateStr); race.setHours(0, 0, 0, 0)
  const days  = Math.round((race.getTime() - today.getTime()) / 86400000)
  if (days < 0)   return { val: String(Math.abs(days)), unit: 'd geleden' }
  if (days === 0)  return { val: 'vandaag', unit: '🏁' }
  if (days < 7)   return { val: String(days), unit: days === 1 ? 'dag' : 'dagen' }
  const weeks = Math.round(days / 7)
  return { val: String(weeks), unit: weeks === 1 ? 'week' : 'weken' }
}

export function RacesBar({ activities, onRacePress }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const races = activities
    .filter(a => a.type === 'race' && a.datum >= today)
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .slice(0, 5)

  if (!races.length) return null

  const main = races[0]
  const cd   = countdown(main.datum)
  const [, mm, dd] = main.datum.split('-')

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.chip}
        onPress={() => onRacePress(main.datum)}
        activeOpacity={0.8}
      >
        <View style={styles.dot} />
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {main.titel || main.datum}
            {main.km != null ? ` · ${main.km} km` : ''}
          </Text>
          <Text style={styles.meta}>
            {dd} {['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][parseInt(mm) - 1]}
          </Text>
        </View>
        <View style={styles.countdown}>
          <Text style={styles.countdownVal}>{cd.val}</Text>
          <Text style={styles.countdownUnit}>{cd.unit}</Text>
        </View>
      </TouchableOpacity>

      {races.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moreScroll}>
          {races.slice(1).map(r => {
            const rcd = countdown(r.datum)
            return (
              <TouchableOpacity key={r.id} style={styles.moreChip} onPress={() => onRacePress(r.datum)}>
                <Text style={styles.moreName} numberOfLines={1}>{r.titel || r.datum}</Text>
                <Text style={styles.moreMeta}>{rcd.val} {rcd.unit}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: LightTheme.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(200,51,107,0.25)' },
  dot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C8336B', flexShrink: 0 },
  body:           { flex: 1, minWidth: 0 },
  name:           { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: LightTheme.text },
  meta:           { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted, marginTop: 1 },
  countdown:      { alignItems: 'flex-end', flexShrink: 0 },
  countdownVal:   { fontFamily: Fonts.displayBold, fontSize: 18, color: LightTheme.text, letterSpacing: -0.5, lineHeight: 22 },
  countdownUnit:  { fontFamily: Fonts.mono, fontSize: 10, color: LightTheme.muted },
  moreScroll:     { marginTop: Spacing.sm },
  moreChip:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: LightTheme.surface, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginRight: Spacing.sm, borderWidth: 1, borderColor: LightTheme.border },
  moreName:       { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.text },
  moreMeta:       { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted },
})
