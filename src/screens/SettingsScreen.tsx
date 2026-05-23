import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AccountSection } from '@/components/settings/AccountSection'
import { ConnectSection } from '@/components/settings/ConnectSection'
import { NotifSection } from '@/components/settings/NotifSection'
import { PushSection } from '@/components/settings/PushSection'
import { PrefsSection } from '@/components/settings/PrefsSection'
import { SchemaTracerSection } from '@/components/settings/SchemaTracerSection'
import { LightTheme, Fonts, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import type { RootStackParamList } from '@/navigation/RootNavigator'

const ADMIN_EMAIL = 'info@runyo.app'

export function SettingsScreen() {
  const insets     = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const theme      = useTheme()
  const email      = useAuthStore(s => s.tokenSet?.email)

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title row — inside scroll so it scrolls away */}
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Profiel</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Section title="Account">
          <AccountSection />
        </Section>

        {__DEV__ && (
          <Section title="Schema (tracer)">
            <SchemaTracerSection />
          </Section>
        )}

        <Section title="Schema">
          <ConnectSection />
        </Section>

        <Section title="Push notificaties">
          <PushSection />
        </Section>

        <Section title="Telegram notificaties">
          <NotifSection />
        </Section>

        <Section title="Voorkeuren">
          <PrefsSection />
        </Section>

        {email === ADMIN_EMAIL && (
          <Section title="Admin">
            <TouchableOpacity
              style={adminStyles.row}
              onPress={() => navigation.navigate('ImportLog')}
              activeOpacity={0.7}
            >
              <Text style={[adminStyles.label, { color: theme.text }]}>importeerlog</Text>
              <Text style={[adminStyles.arrow, { color: theme.muted }]}>›</Text>
            </TouchableOpacity>
          </Section>
        )}
      </ScrollView>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={[sectionStyles.body, { backgroundColor: theme.surface }]}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: LightTheme.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  titleRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.lg },
  pageTitle:     { fontFamily: Fonts.displayBold, fontSize: 28, color: LightTheme.text, letterSpacing: -0.5 },
  closeBtn:      { padding: Spacing.sm },
  closeBtnText:  { fontFamily: Fonts.display, fontSize: 20, color: LightTheme.muted },
})

const sectionStyles = StyleSheet.create({
  container: { marginBottom: Spacing.xl },
  title:     { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  body:      { backgroundColor: LightTheme.surface, borderRadius: 12, padding: Spacing.lg },
})

const adminStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: Fonts.displayMedium, fontSize: 15 },
  arrow: { fontFamily: Fonts.display, fontSize: 20 },
})
