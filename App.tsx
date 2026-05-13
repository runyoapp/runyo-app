import { useEffect } from 'react'
import { useFonts } from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StyleSheet } from 'react-native'
import { RootNavigator } from '@/navigation/RootNavigator'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { LightTheme } from '@/constants/theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
})

export default function App() {
  const hydrateAuth     = useAuthStore(s => s.hydrate)
  const hydrateSettings = useSettingsStore(s => s.hydrate)

  const [fontsLoaded] = useFonts({
    'Sora':                  require('./assets/fonts/Sora-Regular.ttf'),
    'Sora-Medium':           require('./assets/fonts/Sora-Medium.ttf'),
    'Sora-SemiBold':         require('./assets/fonts/Sora-SemiBold.ttf'),
    'Sora-Bold':             require('./assets/fonts/Sora-Bold.ttf'),
    'JetBrainsMono':         require('./assets/fonts/JetBrainsMono-Regular.ttf'),
    'JetBrainsMono-Medium':  require('./assets/fonts/JetBrainsMono-Medium.ttf'),
  })

  useEffect(() => {
    Promise.all([hydrateAuth(), hydrateSettings()])
  }, [])

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <StatusBar style="dark" backgroundColor={LightTheme.bg} />
            <RootNavigator />
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
