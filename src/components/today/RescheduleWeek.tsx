import { useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import { getWeekDates } from '@/utils/date'
import { WeekDragStrip, buildWeekCells, catColor } from '@/components/shared/WeekDragStrip'
import type { Activity } from '@/types/activity'

type Props = {
  activities: Activity[]
  // Geselecteerde dag (YYYY-MM-DD) — bepaalt welke dag-stip oplicht; volgt het swipen.
  selectedDate: string
  // Tik op een sessie → details tonen (afgehandeld door TodayScreen).
  onOpenActivity: (activity: Activity) => void
}

// Inklapbare "Deze week"-strip. Ingeklapt: dag-dots als context. Uitgeklapt: de
// gedeelde versleepbare weekstrip (WeekDragStrip) voor de huidige week, waarin je
// een sessie kunt vastpakken en op een andere dag laat vallen → reschedule.
export function RescheduleWeek({ activities, selectedDate, onOpenActivity }: Props) {
  const theme    = useTheme()
  const [open, setOpen] = useState(false)

  const weekDates = useMemo(() => getWeekDates(0), [])
  const week = useMemo(
    () => buildWeekCells(activities, weekDates, selectedDate),
    [activities, weekDates, selectedDate],
  )

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Header — altijd zichtbaar, tikbaar; dag-dots als compacte context */}
      <Pressable style={styles.header} onPress={() => setOpen(o => !o)}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Deze week</Text>
        <View style={styles.dots}>
          {week.map(d => (
            <View
              key={d.datum}
              style={[
                styles.dot,
                {
                  width: d.isSelected ? 22 : 18,
                  height: d.isSelected ? 22 : 18,
                  backgroundColor: d.isSelected ? theme.text : theme.surface2,
                  borderColor: d.isSelected ? theme.text : theme.border,
                },
              ]}
            >
              {d.sessions[0] && (
                <View
                  style={[
                    styles.dotInner,
                    { backgroundColor: d.isSelected ? theme.accent : catColor(d.sessions[0].type, theme) },
                  ]}
                />
              )}
            </View>
          ))}
        </View>
        <Text style={[styles.chevron, { color: theme.muted }, open && styles.chevronOpen]}>›</Text>
      </Pressable>

      {/* Uitgeklapt: gedeelde versleepbare week */}
      {open && (
        <View style={[styles.body, { borderTopColor: theme.border }]}>
          <WeekDragStrip
            weekDates={weekDates}
            activities={activities}
            selectedDate={selectedDate}
            onOpenActivity={onOpenActivity}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card:        { borderWidth: 1, borderRadius: Radius.lg, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, overflow: 'hidden' },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  headerTitle: { flex: 1, fontFamily: Fonts.displayBold, fontSize: 14, letterSpacing: -0.2 },
  dots:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:         { borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dotInner:    { width: 6, height: 6, borderRadius: 3 },
  chevron:     { fontFamily: Fonts.display, fontSize: 16, marginLeft: 2 },
  chevronOpen: { transform: [{ rotate: '90deg' }] },

  body:        { borderTopWidth: 1, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10 },
})
