import { useFonts } from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { Text, View, StyleSheet } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { LightTheme } from '@/constants/theme'

export default function App() {
  const [fontsLoaded] = useFonts({
    'Sora': require('./assets/fonts/Sora-Regular.ttf'),
    'Sora-Medium': require('./assets/fonts/Sora-Medium.ttf'),
    'Sora-SemiBold': require('./assets/fonts/Sora-SemiBold.ttf'),
    'Sora-Bold': require('./assets/fonts/Sora-Bold.ttf'),
    'JetBrainsMono': require('./assets/fonts/JetBrainsMono-Regular.ttf'),
    'JetBrainsMono-Medium': require('./assets/fonts/JetBrainsMono-Medium.ttf'),
  })

  // Fonts not yet downloaded — see assets/fonts/README.md
  // Renders with system font until font files are in place
  if (!fontsLoaded) return null

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={LightTheme.bg} />
      <View style={styles.container}>
        <Text style={styles.logo}>runyo</Text>
        <Text style={styles.tagline}>Train · Race · Repeat</Text>
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LightTheme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontFamily: 'Sora-Bold',
    fontSize: 32,
    color: LightTheme.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: 'JetBrainsMono',
    fontSize: 13,
    color: LightTheme.accent,
    marginTop: 8,
  },
})
