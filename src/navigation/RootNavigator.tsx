import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { MainNavigator } from './MainNavigator'
import { OnboardingScreen } from '@/screens/OnboardingScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { ImportLogScreen } from '@/screens/ImportLogScreen'
import { EmailAuthScreen } from '@/screens/EmailAuthScreen'

export type RootStackParamList = {
  EmailAuth: undefined
  Onboarding: undefined
  Main: undefined
  Settings: undefined
  ImportLog: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export function RootNavigator() {
  const onboardingDone = useSettingsStore(s => s.onboardingDone)
  const tokenSet       = useAuthStore(s => s.tokenSet)
  const isLoading      = useAuthStore(s => s.isLoading)
  const schemaId       = useDataStore(s => s.schemaId)

  if (isLoading) return null

  const isAuthenticated = !!tokenSet
  const hasSchema       = !!schemaId

  // U37: tabs altijd zichtbaar — LoginScreen is nu een tab-inhoud-overlay,
  // geen eigen route meer. Onboarding alleen na eerste login.
  // U45: schemakeuze (Onboarding) overslaan als er al een schema gekoppeld is —
  // direct naar Main (Vandaag-tab).
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated && !onboardingDone && !hasSchema ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <>
          <Stack.Screen name="Main"     component={MainNavigator} />
          <Stack.Screen name="EmailAuth" component={EmailAuthScreen}
            options={{ headerShown: true, title: '', headerBackTitle: 'Terug', headerStyle: { backgroundColor: '#F1EEE6' }, headerShadowVisible: false, presentation: 'modal' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen
            name="ImportLog"
            component={ImportLogScreen}
            options={{ headerShown: false, presentation: 'modal' }}
          />
        </>
      )}
    </Stack.Navigator>
  )
}
