import { createNavigationContainerRef } from '@react-navigation/native'
import type { RootStackParamList } from './RootNavigator'

// Globale navigatie-ref zodat ook niet-component-code (bv. de logout-service) en
// losse modals naar een tab kunnen springen zonder een navigation-prop.
export const navigationRef = createNavigationContainerRef<RootStackParamList>()

// Spring naar de Vandaag-tab en sluit een eventueel open modaal (Settings/wizard)
// door terug te navigeren naar de Main-stack-screen.
export function goToToday(): void {
  if (!navigationRef.isReady()) return
  // Genest navigeren naar de Today-tab binnen de Main-stack; cast omdat de
  // RootStackParamList Main als parameterloos type heeft.
  ;(navigationRef.navigate as (name: string, params?: object) => void)('Main', { screen: 'Today' })
}

// Spring naar de Plan-tab (bv. om na een import de weekbouwer te openen via de
// weekbouwerTarget in uiStore).
export function goToPlan(): void {
  if (!navigationRef.isReady()) return
  ;(navigationRef.navigate as (name: string, params?: object) => void)('Main', { screen: 'Plan' })
}
