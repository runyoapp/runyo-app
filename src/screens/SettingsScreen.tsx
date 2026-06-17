import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AccountSection } from '@/components/settings/AccountSection'
import { ConnectSection } from '@/components/settings/ConnectSection'
import { NotifSection } from '@/components/settings/NotifSection'
import { PushSection } from '@/components/settings/PushSection'
import { SchemaTracerSection } from '@/components/settings/SchemaTracerSection'
import { PreferencesRow } from '@/components/settings/PreferencesRow'
import { SectionLabel, Card } from '@/components/settings/ui'
import { Fonts, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import type { RootStackParamList } from '@/navigation/RootNavigator'

// Accounts die de Admin-sectie (importeerlog) te zien krijgen. Moet matchen met
// ADMIN_EMAILS op de backend (runyo-auth) — daar zit de echte toegangscontrole.
const ADMIN_EMAILS = ['info@runyo.app', 'luukvanm@gmail.com']

export function SettingsScreen() {
  const insets     = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const theme      = useTheme()
  const tokenSet   = useAuthStore(s => s.tokenSet)
  const email      = tokenSet?.email
  const loggedIn   = !!tokenSet
  const isAdmin    = email != null && ADMIN_EMAILS.includes(email)

  const [scrolled, setScrolled] = useState(false)
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrolled(e.nativeEvent.contentOffset.y > 4)
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Sticky header */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: scrolled ? theme.border : 'transparent' }]}>
        <Text style={[styles.title, { color: theme.text }]}>Profiel</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.closeBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.closeText, { color: theme.text2 }]}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <PreferencesRow />

        <AccountSection />

        {__DEV__ && (
          <>
            <View style={styles.gap} />
            <SectionLabel>Schema (tracer)</SectionLabel>
            <Card style={styles.tracerCard}>
              <SchemaTracerSection />
            </Card>
          </>
        )}

        <View style={styles.gap} />
        <ConnectSection />

        {loggedIn && (
          <>
            <View style={styles.gap} />
            <NotifSection />

            {Platform.OS !== 'web' && (
              <>
                <View style={styles.gap} />
                <PushSection />
              </>
            )}

            {isAdmin && (
              <>
                <View style={styles.gap} />
                <SectionLabel>Admin</SectionLabel>
                <Card>
                  <TouchableOpacity
                    style={styles.adminRow}
                    onPress={() => navigation.navigate('ImportLog')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.adminLabel, { color: theme.text }]}>Importeerlog</Text>
                    <Text style={[styles.adminArrow, { color: theme.muted }]}>›</Text>
                  </TouchableOpacity>
                </Card>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, borderBottomWidth: 1, zIndex: 5 },
  title:         { fontFamily: Fonts.displayBold, fontSize: 27, letterSpacing: -1 },
  closeBtn:      { width: 34, height: 34, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  closeText:     { fontFamily: Fonts.display, fontSize: 17 },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4 },
  gap:           { height: 22 },
  tracerCard:    { padding: 4 },

  adminRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 15 },
  adminLabel:    { fontFamily: Fonts.displaySemiBold, fontSize: 14.5, letterSpacing: -0.1 },
  adminArrow:    { fontFamily: Fonts.display, fontSize: 18 },
})
