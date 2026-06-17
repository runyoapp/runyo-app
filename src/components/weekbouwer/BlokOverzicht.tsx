import { Modal, View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { ActivityColors, Fonts, Spacing } from '@/constants/theme'
import type { PlanWeekData } from '@/components/plan/PlanWeek'

type Props = {
  visible: boolean
  weeks: PlanWeekData[]
  activeMonday: string
  onClose: () => void
  onPickWeek: (monday: string) => void
}

const BAR_MAX_H = 78

// Paneel dat van bovenaf inschuift met staven voor de hele schema-looptijd.
// Hoogte = goalKm genormaliseerd; kleur = mint-intensiteit op km (donkerder =
// meer volume). Raceweek = rood. Huidige week = outline.
export function BlokOverzicht({ visible, weeks, activeMonday, onClose, onPickWeek }: Props) {
  const theme  = useTheme()
  const maxKm  = weeks.reduce((m, w) => Math.max(m, w.goalKm), 0) || 1

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.panel, { backgroundColor: theme.bg }]}
          onPress={() => {}}
        >
          <View style={styles.head}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>
                {weeks.length}-weken blok
              </Text>
              <Text style={[styles.sub, { color: theme.muted }]}>Tik een week om erheen te springen</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: theme.muted }]}>sluiten ↑</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chart}>
            {weeks.map(w => {
              const frac    = w.goalKm / maxKm
              const h       = Math.max(4, frac * BAR_MAX_H)
              const current = w.monday === activeMonday
              // Mint-intensiteit: 0.35 (laag) → 1 (hoog) op km.
              const opacity = 0.35 + frac * 0.65
              const hex     = theme.accent.replace('#', '')
              const r = parseInt(hex.slice(0, 2), 16)
              const g = parseInt(hex.slice(2, 4), 16)
              const b = parseInt(hex.slice(4, 6), 16)
              const color = w.hasRace
                ? ActivityColors.race.text
                : `rgba(${r}, ${g}, ${b}, ${opacity})`

              return (
                <TouchableOpacity
                  key={w.monday}
                  style={styles.barCol}
                  activeOpacity={0.7}
                  onPress={() => onPickWeek(w.monday)}
                >
                  <Text style={[styles.barKm, { color: current ? theme.text : 'transparent' }]}>
                    {w.goalKm}
                  </Text>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: h,
                        backgroundColor: color,
                        borderWidth: current ? 2 : 0,
                        borderColor: current ? theme.text : 'transparent',
                      },
                    ]}
                  />
                  <Text style={[styles.barNum, {
                    color: current ? theme.text : theme.muted,
                    fontFamily: current ? Fonts.monoMedium : Fonts.mono,
                  }]}>
                    {w.num}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={[styles.caption, { color: theme.muted }]}>donkerder = meer volume</Text>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop:  { flex: 1, justifyContent: 'flex-start', backgroundColor: 'rgba(14,31,26,0.5)' },
  panel:     { borderBottomLeftRadius: 20, borderBottomRightRadius: 20, paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 20 },

  head:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  title:     { fontFamily: Fonts.displayBold, fontSize: 17, letterSpacing: -0.3 },
  sub:       { fontFamily: Fonts.display, fontSize: 12, marginTop: 2 },
  closeBtn:  { paddingHorizontal: 8, paddingVertical: 4 },
  closeText: { fontFamily: Fonts.display, fontSize: 13 },

  chart:     { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 110, marginBottom: 10 },
  barCol:    { flex: 1, alignItems: 'center', gap: 4 },
  barKm:     { fontFamily: Fonts.mono, fontSize: 8, fontWeight: '700' },
  bar:       { width: '100%', borderRadius: 4 },
  barNum:    { fontSize: 8 },

  caption:   { fontFamily: Fonts.display, fontSize: 11.5 },
})
