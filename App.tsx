import { useEffect, useState } from 'react'
import { useFonts } from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, type InitialState } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { View, StyleSheet, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
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

// U36: navigatiestate bewaren zodat een page-refresh op web terugkeert naar
// hetzelfde tabblad i.p.v. altijd Vandaag. Alleen web — native heeft geen refresh.
const NAV_STATE_KEY = 'runyo_nav_state'
const isWeb = Platform.OS === 'web'

export default function App() {
  const hydrateAuth     = useAuthStore(s => s.hydrate)
  const tokenSet        = useAuthStore(s => s.tokenSet)
  const hydrateSettings = useSettingsStore(s => s.hydrate)
  const hydrateSchema   = useDataStore(s => s.hydrateSchema)
  const loadMySchemas   = useDataStore(s => s.loadMySchemas)

  const [isNavReady, setIsNavReady]   = useState(!isWeb)
  const [initialState, setInitialState] = useState<InitialState | undefined>(undefined)

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

  // U36: bewaarde navigatiestate laden vóór de eerste render (alleen web)
  useEffect(() => {
    if (!isWeb) return
    AsyncStorage.getItem(NAV_STATE_KEY)
      .then(saved => { if (saved) setInitialState(JSON.parse(saved)) })
      .catch(() => { /* corrupte state negeren, val terug op default */ })
      .finally(() => setIsNavReady(true))
  }, [])

  // runyo v4 — once auth is hydrated and a tokenSet is present, load the
  // backend schemaId so /api/schemas/:id/activities is usable from any screen
  // (ticket 2.1d). Silent on failure: legacy Sheets-flow remains available.
  useEffect(() => {
    if (!tokenSet) return
    loadMySchemas().catch(() => { /* surface in UI later */ })
  }, [tokenSet, loadMySchemas])

  if (!fontsLoaded || !isNavReady) return null

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <NavigationContainer
              initialState={initialState}
              onStateChange={state => {
                if (isWeb) AsyncStorage.setItem(NAV_STATE_KEY, JSON.stringify(state)).catch(() => {})
              }}
            >
              <StatusBar style="dark" backgroundColor={LightTheme.bg} />
              <RootNavigator />
            </NavigationContainer>
          </QueryClientProvider>
        </SafeAreaProvider>
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
