import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { MainNavigator } from './MainNavigator'
import { OnboardingScreen } from '@/screens/OnboardingScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { LoginScreen } from '@/screens/LoginScreen'
import { EmailAuthScreen } from '@/screens/EmailAuthScreen'

export type RootStackParamList = {
  Login: undefined
  EmailAuth: undefined
  Onboarding: undefined
  Main: undefined
  Settings: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export function RootNavigator() {
  const onboardingDone = useSettingsStore(s => s.onboardingDone)
  const tokenSet       = useAuthStore(s => s.tokenSet)
  const isLoading      = useAuthStore(s => s.isLoading)

  if (isLoading) return null

  const isAuthenticated = !!tokenSet

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login"     component={LoginScreen} />
          <Stack.Screen name="EmailAuth" component={EmailAuthScreen}
            options={{ headerShown: true, title: '', headerBackTitle: 'Terug', headerStyle: { backgroundColor: '#F1EEE6' }, headerShadowVisible: false }}
          />
        </>
      ) : !onboardingDone ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <>
          <Stack.Screen name="Main"     component={MainNavigator} />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ headerShown: false, presentation: 'modal' }}
          />
        </>
      )}
    </Stack.Navigator>
  )
}
