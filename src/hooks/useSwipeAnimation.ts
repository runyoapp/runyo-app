import { useRef, useEffect } from 'react'
import { Animated } from 'react-native'

export function useSwipeAnimation(key: number) {
  const translateX = useRef(new Animated.Value(0)).current
  const opacity    = useRef(new Animated.Value(1)).current
  const prevKey    = useRef(key)

  useEffect(() => {
    if (prevKey.current === key) return
    const dir = key > prevKey.current ? 1 : -1
    prevKey.current = key

    translateX.setValue(dir * 40)
    opacity.setValue(0.4)

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        tension: 220,
        friction: 22,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start()
  }, [key])

  return { style: { transform: [{ translateX }], opacity } }
}

// U40: dagstrip animeert alleen bij week-grens (zondag→maandag of maandag→zondag).
// Geeft een aparte animatie-stijl terug die alleen triggert als de week verandert.
export function useDayStripAnimation(dayOffset: number) {
  const translateX  = useRef(new Animated.Value(0)).current
  const opacity     = useRef(new Animated.Value(1)).current
  const prevOffset  = useRef(dayOffset)

  function weekOf(offset: number): number {
    // ISO week: elke 7 dagen telt als een nieuwe week vanuit offset 0
    return Math.floor(offset / 7)
  }

  useEffect(() => {
    const prevWeek = weekOf(prevOffset.current)
    const currWeek = weekOf(dayOffset)
    const prev     = prevOffset.current
    prevOffset.current = dayOffset

    if (prevWeek === currWeek) return

    const dir = dayOffset > prev ? 1 : -1
    translateX.setValue(dir * 20)
    opacity.setValue(0.5)

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        tension: 300,
        friction: 26,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start()
  }, [dayOffset])

  return { style: { transform: [{ translateX }], opacity } }
}
