import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'
import { TodayScreen } from '@/screens/TodayScreen'
import { PlanScreen } from '@/screens/PlanScreen'
import { RacesScreen } from '@/screens/RacesScreen'
import { Fonts, GlassBg, Spacing } from '@/constants/theme'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { useTheme } from '@/hooks/useTheme'
import { useActivities } from '@/hooks/useActivities'
import { Toast } from '@/components/shared/Toast'

export type MainTabParamList = {
  Today: undefined
  Plan:  undefined
  Races: undefined
}

const Tab = createBottomTabNavigator<MainTabParamList>()

const TAB_LABELS: Record<string, string> = {
  Today: 'vandaag',
  Plan:  'plan',
  Races: 'races',
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

function DesktopSidebar({ state, navigation }: any) {
  const theme    = useTheme()
  const insets   = useSafeAreaInsets()

  return (
    <View style={[
      sidebarStyles.sidebar,
      { backgroundColor: theme.surface, borderRightColor: theme.border, paddingTop: insets.top + Spacing.lg },
    ]}>
      <Text style={[sidebarStyles.logo, { color: theme.accent }]}>runyo</Text>
      <View style={sidebarStyles.items}>
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index
          return (
            <TouchableOpacity
              key={route.key}
              style={[sidebarStyles.item, focused && { backgroundColor: theme.accentGlow }]}
              onPress={() => navigation.navigate(route.name)}
              activeOpacity={0.8}
            >
              <Text style={[
                sidebarStyles.itemLabel,
                { color: focused ? theme.accent : theme.text2 },
                focused && sidebarStyles.itemLabelActive,
              ]}>
                {TAB_LABELS[route.name]}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

export function MainNavigator() {
  const isDesktop    = useIsDesktop()
  const tabBarHidden = useUiStore(s => s.tabBarHidden)
  // A3: één centrale activiteiten-fetch+merge voor alle tabs. Today/Plan/Races
  // lezen de data + laadstatus uit de store i.p.v. de hook elk apart te draaien
  // (voorheen 3× merge + 3× setActivities per update).
  useActivities()

  return (
    <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>
      <Tab.Navigator
        tabBar={props => tabBarHidden
          ? null
          : isDesktop
            ? <DesktopSidebar {...props} />
            : <FloatingTabBar {...props} />
        }
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Today" component={TodayScreen} />
        <Tab.Screen name="Plan"  component={PlanScreen} />
        <Tab.Screen name="Races" component={RacesScreen} />
      </Tab.Navigator>
      {/* Globaal — toast werkt zo op elke tab, niet alleen op Vandaag */}
      <Toast />
    </View>
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

const sidebarStyles = StyleSheet.create({
  sidebar: {
    width: 200,
    borderRightWidth: 1,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  logo: {
    fontFamily: Fonts.displayBold,
    fontSize: 20,
    letterSpacing: -0.5,
    marginBottom: Spacing.xl,
  },
  items: {
    gap: 4,
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
  },
  itemLabel: {
    fontFamily: Fonts.displayMedium,
    fontSize: 14,
    letterSpacing: -0.1,
  },
  itemLabelActive: {
    fontFamily: Fonts.displayBold,
  },
})
