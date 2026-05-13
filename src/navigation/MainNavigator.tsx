import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSettingsStore } from '@/stores/settingsStore'
import { TodayScreen } from '@/screens/TodayScreen'
import { WeekScreen } from '@/screens/WeekScreen'
import { PlanScreen } from '@/screens/PlanScreen'
import { CalendarScreen } from '@/screens/CalendarScreen'
import { Fonts, GlassBg } from '@/constants/theme'

export type MainTabParamList = {
  Today:    undefined
  Week:     undefined
  Plan:     undefined
  Calendar: undefined
}

const Tab = createBottomTabNavigator<MainTabParamList>()

const TAB_LABELS: Record<string, string> = {
  Today:    'vandaag',
  Week:     'week',
  Plan:     'training',
  Calendar: 'kalender',
}

// Canonical glass tab bar — spec: brand.md §7, runyo-pwa.jsx GlassTabBar
// Dark glass pill, floating, mint active pill, inactive white/55%
function FloatingTabBar({ state, navigation }: any) {
  const insets   = useSafeAreaInsets()
  const themePref = useSettingsStore(s => s.prefs.theme)
  const mode      = themePref === 'dark' ? 'dark' : 'light'

  const glassBg   = GlassBg[mode]
  const activeColor = '#00B98E'       // always mint regardless of mode
  const activeInk   = '#062019'       // accent-ink
  const inactiveColor = mode === 'light'
    ? 'rgba(255,255,255,0.55)'
    : 'rgba(234,239,236,0.55)'

  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 16 }]}>
      <BlurView intensity={40} tint={mode === 'dark' ? 'dark' : 'light'} style={styles.blur}>
        <View style={[styles.pill, { backgroundColor: glassBg }]}>
          {state.routes.map((route: any, index: number) => {
            const focused = state.index === index
            return (
              <TouchableOpacity
                key={route.key}
                style={[styles.tab, focused && { backgroundColor: activeColor }]}
                onPress={() => navigation.navigate(route.name)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.tabLabel,
                  { color: focused ? activeInk : inactiveColor },
                  focused && styles.tabLabelActive,
                ]}>
                  {TAB_LABELS[route.name]}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </BlurView>
    </View>
  )
}

export function MainNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Today"    component={TodayScreen} />
      <Tab.Screen name="Week"     component={WeekScreen} />
      <Tab.Screen name="Plan"     component={PlanScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#0E1F1A',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  blur: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  pill: {
    flexDirection: 'row',
    padding: 6,
    gap: 2,
    borderRadius: 999,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabLabel: {
    fontFamily: Fonts.displayMedium,
    fontSize: 12,
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    fontFamily: Fonts.displayBold,
  },
})
