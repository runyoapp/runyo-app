import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { Fonts, Spacing, Radius, schemaColor } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import type { SchemaMeta } from '@/stores/dataStore'

type Props = {
  schemas:  SchemaMeta[]   // zichtbare schema's (volgorde = chip-volgorde)
  activeId: string | null
  onSelect: (id: string) => void
}

// Chip-rij bovenaan Plan om te kiezen welk schema de tijdlijn toont. Alleen
// zinvol bij 2+ zichtbare schema's; de aanroeper rendert 'm dan pas. Wisselt
// uitsluitend de Plan-weergave, niet de globale primary (Today/Stats).
export function SchemaSwitcher({ schemas, activeId, onSelect }: Props) {
  const theme = useTheme()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {schemas.map(s => {
        const active = s.id === activeId
        const dot    = schemaColor(s, schemas)
        return (
          <Pressable
            key={s.id}
            onPress={() => onSelect(s.id)}
            style={[
              styles.chip,
              { borderColor: active ? dot : theme.border, backgroundColor: active ? theme.surface : 'transparent' },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: dot }]} />
            <Text
              numberOfLines={1}
              style={[styles.label, { color: active ? theme.text : theme.muted }]}
            >
              {s.name}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  // Horizontale ScrollView in een flex-kolom: niet laten meeschalen/krimpen,
  // anders drukt de verticale weken-lijst eronder 'm op de eerste render plat
  // (hoogte 0) en valt het weekoverzicht over de schema-chips heen.
  scroll: { flexGrow: 0, flexShrink: 0 },
  row:   { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm },
  chip:  {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical:   8,
    borderRadius:  Radius.md,
    borderWidth:   1,
    maxWidth:      200,
  },
  dot:   { width: 9, height: 9, borderRadius: 5 },
  label: { fontFamily: Fonts.displayMedium, fontSize: 13 },
})
