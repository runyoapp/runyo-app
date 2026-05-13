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
