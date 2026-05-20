import { useEffect } from 'react'
import { useFonts } from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View, StyleSheet } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RootNavigator } from '@/navigation/RootNavigator'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDataStore } from '@/stores/dataStore'
import { LightTheme } from '@/constants/theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
})

export default function App() {
  const hydrateAuth     = useAuthStore(s => s.hydrate)
  const tokenSet        = useAuthStore(s => s.tokenSet)
  const hydrateSettings = useSettingsStore(s => s.hydrate)
  const hydrateSchema   = useDataStore(s => s.hydrateSchema)
  const loadMySchemas   = useDataStore(s => s.loadMySchemas)

  const [fontsLoaded] = useFonts({
    'Sora':                 require('./assets/fonts/Sora/Sora-Regular.ttf'),
    'Sora-Medium':          require('./assets/fonts/Sora/Sora-Medium.ttf'),
    'Sora-SemiBold':        require('./assets/fonts/Sora/Sora-SemiBold.ttf'),
    'Sora-Bold':            require('./assets/fonts/Sora/Sora-Bold.ttf'),
    'JetBrainsMono':        require('./assets/fonts/JetBrainsMono/JetBrainsMono-Regular.ttf'),
    'JetBrainsMono-Medium': require('./assets/fonts/JetBrainsMono/JetBrainsMono-Medium.ttf'),
  })

  useEffect(() => {
    Promise.all([hydrateAuth(), hydrateSettings(), hydrateSchema()])
  }, [])

  // runyo v4 — once auth is hydrated and a tokenSet is present, load the
  // backend schemaId so /api/schemas/:id/activities is usable from any screen
  // (ticket 2.1d). Silent on failure: legacy Sheets-flow remains available.
  useEffect(() => {
    if (!tokenSet) return
    loadMySchemas().catch(() => { /* surface in UI later */ })
  }, [tokenSet, loadMySchemas])

  if (!fontsLoaded) return null

  return (
    <View style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <StatusBar style="dark" backgroundColor={LightTheme.bg} />
            <RootNavigator />
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
