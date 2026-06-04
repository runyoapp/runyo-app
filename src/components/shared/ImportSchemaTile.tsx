import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Fonts, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

// Gedeelde import-knop — identiek op alle tabbladen (lege-staat) én in
// Instellingen. De "Aanbevolen"-badge tonen we alleen in Instellingen
// (recommended-prop); op de tabbladen niet.
export function ImportSchemaTile({ onPress, recommended }: { onPress: () => void; recommended?: boolean }) {
  const theme = useTheme()
  return (
    <TouchableOpacity
      style={[styles.tile, { backgroundColor: theme.text, borderColor: theme.text }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.icon, { backgroundColor: theme.accent }]}>
        <Text style={styles.iconText}>✦</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Importeer eigen schema</Text>
          {recommended && (
            <View style={[styles.badge, { backgroundColor: theme.accent }]}>
              <Text style={[styles.badgeText, { color: theme.accentInk }]}>Aanbevolen</Text>
            </View>
          )}
        </View>
        <Text style={styles.sub}>PDF, Excel, foto of link</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  tile:      { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: Radius.lg, padding: 16 },
  icon:      { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  iconText:  { fontSize: 20 },
  body:      { flex: 1, minWidth: 0 },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title:     { fontFamily: Fonts.displaySemiBold, fontSize: 15, color: '#fff', letterSpacing: -0.1 },
  badge:     { borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontFamily: Fonts.displayBold, fontSize: 9, letterSpacing: -0.1 },
  sub:       { fontFamily: Fonts.display, fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  chevron:   { fontFamily: Fonts.display, fontSize: 20, color: 'rgba(255,255,255,0.5)' },
})
