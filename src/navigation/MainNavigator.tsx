import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TodayScreen } from '@/screens/TodayScreen'
import { WeekScreen } from '@/screens/WeekScreen'
import { PlanScreen } from '@/screens/PlanScreen'
import { CalendarScreen } from '@/screens/CalendarScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { LightTheme, Fonts, Radius } from '@/constants/theme'

export type MainTabParamList = {
  Today: undefined
  Week: undefined
  Plan: undefined
  Calendar: undefined
  Settings: undefined
}

const Tab = createBottomTabNavigator<MainTabParamList>()

const TAB_LABELS: Record<string, string> = {
  Today:    'Vandaag',
  Week:     'Week',
  Plan:     'Schema',
  Calendar: 'Kalender',
  Settings: 'Profiel',
}

export function MainNavigator() {
  const insets = useSafeAreaInsets()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [styles.tabBar, { paddingBottom: insets.bottom + 8, height: 56 + insets.bottom }],
        tabBarItemStyle: styles.tabItem,
        tabBarLabel: ({ focused }) => (
          <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
            {TAB_LABELS[route.name]}
          </Text>
        ),
        tabBarIcon: () => null,
        tabBarActiveTintColor: LightTheme.accent,
        tabBarInactiveTintColor: LightTheme.muted,
      })}
    >
      <Tab.Screen name="Today"    component={TodayScreen} />
      <Tab.Screen name="Week"     component={WeekScreen} />
      <Tab.Screen name="Plan"     component={PlanScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: LightTheme.surface,
    borderTopColor: LightTheme.border,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabItem: {
    borderRadius: Radius.md,
  },
  tabLabel: {
    fontFamily: Fonts.displayMedium,
    fontSize: 11,
    color: LightTheme.muted,
  },
  tabLabelActive: {
    color: LightTheme.accent,
  },
})
