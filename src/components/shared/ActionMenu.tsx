import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'

// Lichte, herbruikbare actie-menu op basis van een transparante RN Modal —
// werkt op web (react-native-web) én native. Geen externe dependency nodig.

export type ActionMenuItem = {
  label: string
  icon?: string
  onPress: () => void
  checked?: boolean
  destructive?: boolean
  disabled?: boolean
}

type ActionMenuProps = {
  visible: boolean
  title?: string
  items: ActionMenuItem[]
  onClose: () => void
}

export function ActionMenu({ visible, title, items, onClose }: ActionMenuProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* stopPropagation: tik op de kaart sluit niet */}
        <Pressable style={styles.card} onPress={() => {}}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          ) : null}
          <ScrollView style={styles.scroll} bounces={false} keyboardShouldPersistTaps="handled">
            {items.map((item, i) => (
              <Pressable
                key={`${item.label}-${i}`}
                style={({ pressed }) => [
                  styles.item,
                  pressed && styles.itemPressed,
                  item.disabled && styles.itemDisabled,
                ]}
                disabled={item.disabled}
                onPress={() => {
                  onClose()
                  item.onPress()
                }}
              >
                <Text style={styles.itemIcon}>{item.checked ? '✓' : (item.icon ?? '')}</Text>
                <Text
                  style={[styles.itemLabel, item.destructive && styles.itemLabelDestructive]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: LightTheme.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LightTheme.border,
    paddingVertical: Spacing.xs,
    overflow: 'hidden',
  },
  scroll: { maxHeight: 320 },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 13,
    color: LightTheme.muted,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  itemPressed: { backgroundColor: LightTheme.bgAlt },
  itemDisabled: { opacity: 0.4 },
  itemIcon: { fontSize: 15, width: 20, textAlign: 'center', color: LightTheme.accent },
  itemLabel: { flex: 1, fontFamily: Fonts.displayMedium, fontSize: 15, color: LightTheme.text },
  itemLabelDestructive: { color: '#e53e3e' },
})
