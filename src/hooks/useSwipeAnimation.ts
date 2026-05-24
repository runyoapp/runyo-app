import { useRef, useEffect } from 'react'
import { Animated } from 'react-native'
import { dateFromOffset, weekStart, toDateString } from '@/utils/date'

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
// Week-grens = de maandag van de ISO-week wisselt. Math.floor(offset/7) is fout:
// het splitst op 7-daagse chunks vanuit offset 0, niet op kalendermaandag-grenzen.
export function useDayStripAnimation(dayOffset: number) {
  const translateX  = useRef(new Animated.Value(0)).current
  const opacity     = useRef(new Animated.Value(1)).current
  const prevOffset  = useRef(dayOffset)

  // Canonical week-id = de maandaag-datum van de ISO-week van het gegeven offset.
  function weekId(offset: number): string {
    return toDateString(weekStart(dateFromOffset(offset)))
  }

  useEffect(() => {
    const prevWeek = weekId(prevOffset.current)
    const currWeek = weekId(dayOffset)
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
