import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Fonts, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

type Props = {
  visible: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  /** Korte regel onder de titel (bv. een vriendelijke datum). */
  subtitle?: string
  /** Kleur van het accent-stipje naast de titel (bv. de categorie-kleur). */
  accentDot?: string
  /** Vaste balk onderaan, buiten de scroll (bv. een opslaan-balk). */
  footer?: React.ReactNode
}

export function ModalSheet({ visible, title, onClose, children, subtitle, accentDot, footer }: Props) {
  const insets = useSafeAreaInsets()
  const theme  = useTheme()

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, { paddingTop: insets.top + Spacing.xs }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <View style={styles.headerRow}>
            <View style={styles.titleWrap}>
              <View style={styles.titleRow}>
                {accentDot && <View style={[styles.dot, { backgroundColor: accentDot }]} />}
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
              </View>
              {subtitle && <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>}
            </View>
            <TouchableOpacity onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.closeText, { color: theme.muted }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: footer ? Spacing.lg : insets.bottom + Spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        {footer && (
          <View style={[styles.footer, { backgroundColor: theme.bg, borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.md }]}>
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  header:        { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  handle:        { width: 38, height: 4, borderRadius: 999, alignSelf: 'center', marginBottom: Spacing.md },
  headerRow:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md },
  titleWrap:     { flex: 1, minWidth: 0 },
  titleRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot:           { width: 8, height: 8, borderRadius: 999 },
  title:         { fontFamily: Fonts.displayBold, fontSize: 22, letterSpacing: -0.7, lineHeight: 26 },
  subtitle:      { fontFamily: Fonts.display, fontSize: 12.5, marginTop: 5, letterSpacing: -0.05 },
  closeBtn:      { width: 34, height: 34, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  closeText:     { fontFamily: Fonts.display, fontSize: 16 },
  scroll:        { flex: 1 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.lg },
  footer:        { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1 },
})
