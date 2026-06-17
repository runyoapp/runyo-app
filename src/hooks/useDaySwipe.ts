import { useRef, useMemo } from 'react'
import { PanResponder } from 'react-native'

type SwipeHandlers = ReturnType<typeof PanResponder.create>['panHandlers']

/**
 * Returns stable panHandlers for horizontal day-swipe navigation.
 * The handler captures dayOffset/setDayOffset via a ref so PanResponder
 * isn't recreated on every render (which can desync native gesture state).
 */
export function useDaySwipe(
  dayOffset: number,
  setDayOffset: (offset: number) => void,
  // Zolang locked → geen zijwaartse navigatie (bv. tijdens het slepen van een sessie).
  locked = false,
): SwipeHandlers {
  const navRef = useRef({ dayOffset, setDayOffset, locked })
  navRef.current = { dayOffset, setDayOffset, locked }

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      !navRef.current.locked && Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 12,
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 50) {
        const { dayOffset: d, setDayOffset: set } = navRef.current
        set(d + (g.dx < 0 ? 1 : -1))
      }
    },
  }), [])

  return panResponder.panHandlers
}
