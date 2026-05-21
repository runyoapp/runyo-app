import { useState, useEffect } from 'react'
import { Dimensions } from 'react-native'

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => Dimensions.get('window').width >= 768
  )

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setIsDesktop(window.width >= 768)
    })
    return () => sub.remove()
  }, [])

  return isDesktop
}
