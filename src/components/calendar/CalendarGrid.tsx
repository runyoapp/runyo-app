import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LightTheme, Fonts, Spacing, Radius, ActivityColors } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { toDateString } from '@/utils/date'
import type { Activity } from '@/types/activity'
import type { ActivityType } from '@/constants/activities'

const DOW_LABELS = ['M', 'D', 'W', 'D', 'V', 'Z', 'Z']

type CalCell = { date: Date; other: boolean }

function buildCells(year: number, month: number): CalCell[] {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startPad = (firstDay.getDay() + 6) % 7  // Mon-first

  const cells: CalCell[] = []
  for (let i = 0; i < startPad; i++) {
    cells.push({ date: new Date(year, month, 1 - startPad + i), other: true })
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    cells.push({ date: new Date(year, month, i), other: false })
  }
  while (cells.length % 7 !== 0) {
    const prev = cells[cells.length - 1].date
    const next = new Date(prev)
    next.setDate(prev.getDate() + 1)
    cells.push({ date: next, other: true })
  }
  return cells
}

type Props = {
  year: number
  month: number
  activities: Activity[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}

export function CalendarGrid({ year, month, activities, selectedDate, onSelectDate }: Props) {
  const theme = useTheme()
  const today = toDateString(new Date())
  const cells  = buildCells(year, month)

  // Map date string → primary activity type
  const dateTypeMap: Record<string, ActivityType> = {}
  activities.forEach(a => {
    if (!a.datum || a.type === 'rest' || a.type === 'work') return
    if (!dateTypeMap[a.datum]) dateTypeMap[a.datum] = a.type as ActivityType
  })

  const rows: CalCell[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  return (
    <View>
      {/* Day of week headers */}
      <View style={[styles.row, { marginBottom: 2 }]}>
        {DOW_LABELS.map((label, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.dowLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Day cells */}
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map(({ date, other }) => {
            const ds      = toDateString(date)
            const isToday = ds === today
            const isSel   = ds === selectedDate
            const type    = dateTypeMap[ds]
            const dotColor = type
              ? (isToday ? 'rgba(6,32,25,0.55)' : ActivityColors[type]?.text ?? LightTheme.accent)
              : null

            // Spec: square cells, number top-left, dot bottom-right — runyo-pwa.jsx ScreenKalender
            return (
              <TouchableOpacity
                key={ds}
                style={[
                  styles.cell,
                  { backgroundColor: isToday ? LightTheme.accent : LightTheme.surface, borderColor: isToday ? LightTheme.accent : LightTheme.border },
                  isSel && !isToday && { backgroundColor: LightTheme.accentGlow, borderColor: LightTheme.accent },
                  other && styles.cellOther,
                ]}
                onPress={() => other ? null : onSelectDate(isSel ? null : ds)}
                disabled={other}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dayNum,
                  { color: isToday ? '#fff' : other ? LightTheme.faint : LightTheme.text },
                  isSel && !isToday && { color: LightTheme.accent },
                ]}>
                  {date.getDate()}
                </Text>
                {dotColor && !other && (
                  <View style={[styles.dot, { backgroundColor: dotColor }]} />
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row:       { flexDirection: 'row', gap: 4, marginBottom: 4 },
  // Square cells: number top-left, dot bottom-right — spec: runyo-pwa.jsx ScreenKalender
  cell:      { flex: 1, aspectRatio: 1, padding: 5, borderRadius: Radius.sm, borderWidth: 1, justifyContent: 'space-between' },
  cellOther: { opacity: 0.35 },
  dowLabel:  { fontFamily: Fonts.displayMedium, fontSize: 10, color: LightTheme.faint, textAlign: 'center', paddingVertical: 4 },
  dayNum:    { fontFamily: Fonts.displaySemiBold, fontSize: 12, letterSpacing: -0.1 },
  dot:       { width: 6, height: 6, borderRadius: 3, alignSelf: 'flex-end' },
})
