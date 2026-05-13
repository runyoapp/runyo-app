import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { MainNavigator } from './MainNavigator'
import { OnboardingScreen } from '@/screens/OnboardingScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'

export type RootStackParamList = {
  Onboarding: undefined
  Main: undefined
  Settings: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export function RootNavigator() {
  const onboardingDone = useSettingsStore(s => s.onboardingDone)

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!onboardingDone ? (
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
