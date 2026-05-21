import { View, StyleSheet } from 'react-native'
import type { ReactNode } from 'react'

const MAX_WIDTH = 640

interface Props {
  children: ReactNode
  style?: object
}

export function PageContainer({ children, style }: Props) {
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, style]}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_WIDTH,
  },
})
