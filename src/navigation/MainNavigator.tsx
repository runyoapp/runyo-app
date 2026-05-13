import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TodayScreen } from '@/screens/TodayScreen'
import { WeekScreen } from '@/screens/WeekScreen'
import { PlanScreen } from '@/screens/PlanScreen'
import { CalendarScreen } from '@/screens/CalendarScreen'
import { LightTheme, Fonts } from '@/constants/theme'

export type MainTabParamList = {
  Today:    undefined
  Week:     undefined
  Plan:     undefined
  Calendar: undefined
}

const Tab = createBottomTabNavigator<MainTabParamList>()

const TAB_LABELS: Record<string, string> = {
  Today:    'Vandaag',
  Week:     'Week',
  Plan:     'Schema',
  Calendar: 'Kalender',
}

function FloatingTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 16 }]}>
      <BlurView intensity={80} tint="light" style={styles.blur}>
        <View style={styles.tabRow}>
          {state.routes.map((route: any, index: number) => {
            const focused = state.index === index
            return (
              <TouchableOpacity
                key={route.key}
                style={styles.tab}
                onPress={() => navigation.navigate(route.name)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                  {TAB_LABELS[route.name]}
                </Text>
                {focused && <View style={styles.activeDot} />}
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
    left: 24,
    right: 24,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(222,218,202,0.5)',
  },
  blur: {
    borderRadius: 32,
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.92)' : 'transparent',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tabLabel: {
    fontFamily: Fonts.displayMedium,
    fontSize: 12,
    color: LightTheme.muted,
  },
  tabLabelActive: {
    fontFamily: Fonts.displaySemiBold,
    color: LightTheme.accent,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: LightTheme.accent,
  },
})
