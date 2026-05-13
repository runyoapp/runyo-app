import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AccountSection } from '@/components/settings/AccountSection'
import { ConnectSection } from '@/components/settings/ConnectSection'
import { NotifSection } from '@/components/settings/NotifSection'
import { PrefsSection } from '@/components/settings/PrefsSection'
import { LightTheme, Fonts, Spacing } from '@/constants/theme'

export function SettingsScreen() {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Text style={styles.pageTitle}>Profiel</Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Section title="Account">
          <AccountSection />
        </Section>

        <Section title="Schema">
          <ConnectSection />
        </Section>

        <Section title="Notificaties">
          <NotifSection />
        </Section>

        <Section title="Voorkeuren">
          <PrefsSection />
        </Section>

        <View style={{ height: Spacing.xxl * 2 }} />
      </ScrollView>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.body}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: LightTheme.bg },
  pageTitle:     { fontFamily: Fonts.displayBold, fontSize: 28, color: LightTheme.text, letterSpacing: -0.5, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
})

const sectionStyles = StyleSheet.create({
  container: { marginBottom: Spacing.xl },
  title:     { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  body:      { backgroundColor: LightTheme.surface, borderRadius: 12, padding: Spacing.lg },
})
