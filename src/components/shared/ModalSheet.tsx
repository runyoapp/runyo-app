import { useRef, useEffect } from 'react'
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Animated, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Fonts, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

type Props = {
  visible: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  /** Korte regel onder de titel (bv. een vriendelijke datum). */
  subtitle?: string
  /** Kleur van het accent-stipje naast de titel (bv. de categorie-kleur). */
  accentDot?: string
  /** Vaste balk onderaan, buiten de scroll (bv. een opslaan-balk). */
  footer?: React.ReactNode
  /** Ref naar de interne ScrollView (bv. om naar een ontbrekend veld te scrollen). */
  scrollRef?: React.RefObject<ScrollView | null>
}

// Sluiten door naar beneden te swipen. Voorbij deze drempel (of bij een snelle
// flick) sluit het scherm; anders veert het terug.
const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 900

export function ModalSheet({ visible, title, onClose, children, subtitle, accentDot, footer, scrollRef }: Props) {
  const insets = useSafeAreaInsets()
  const theme  = useTheme()
  const { height } = useWindowDimensions()

  const localScrollRef = useRef<ScrollView | null>(null)
  const sv = scrollRef ?? localScrollRef

  const translateY = useRef(new Animated.Value(0)).current
  // De swipe-vanaf-de-inhoud mag alleen dismissen als de scroll bovenaan staat;
  // anders is omlaag trekken gewoon scrollen. Vastgelegd bij de start van een gebaar.
  const atTop = useRef(true)
  const allow = useRef(false)

  // Bij (her)openen altijd op 0 beginnen — een vorige sluit-swipe liet 'm onderaan staan.
  useEffect(() => { if (visible) translateY.setValue(0) }, [visible])

  function springBack() {
    Animated.spring(translateY, { toValue: 0, tension: 220, friction: 22, useNativeDriver: true }).start()
  }

  function dismiss() {
    Animated.timing(translateY, { toValue: height, duration: 180, useNativeDriver: true })
      .start(() => onClose())
  }

  function settle(translationY: number, velocityY: number) {
    if (translationY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY) dismiss()
    else springBack()
  }

  // Header/handle: altijd swipebaar (geen scroll in de weg).
  const headerPan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY(10)
    .onUpdate(e => translateY.setValue(Math.max(0, e.translationY)))
    .onEnd(e => settle(e.translationY, e.velocityY))

  // Inhoud/achtergrond: swipebaar zolang de scroll bovenaan staat (of niet scrollt).
  // activeOffsetY(10) = alleen omlaag activeren; simultaan met de scroll zodat omhoog
  // scrollen blijft werken.
  const contentPan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY(10)
    .simultaneousWithExternalGesture(sv as unknown as React.RefObject<React.ComponentType>)
    .onBegin(() => { allow.current = atTop.current })
    .onUpdate(e => { if (allow.current) translateY.setValue(Math.max(0, e.translationY)) })
    .onEnd(e => { if (allow.current) settle(e.translationY, e.velocityY); allow.current = false })

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    atTop.current = e.nativeEvent.contentOffset.y <= 0
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[styles.flex, { backgroundColor: theme.bg, transform: [{ translateY }] }]}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <GestureDetector gesture={headerPan}>
              <View style={[styles.header, { paddingTop: insets.top + Spacing.xs }]}>
                <View style={[styles.handle, { backgroundColor: theme.border }]} />
                <View style={styles.headerRow}>
                  <View style={styles.titleWrap}>
                    <View style={styles.titleRow}>
                      {accentDot && <View style={[styles.dot, { backgroundColor: accentDot }]} />}
                      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
                    </View>
                    {subtitle && <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>}
                  </View>
                  <TouchableOpacity onPress={onClose}
                    style={[styles.closeBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.closeText, { color: theme.muted }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </GestureDetector>

            <GestureDetector gesture={contentPan}>
              <ScrollView
                ref={sv}
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: footer ? Spacing.lg : insets.bottom + Spacing.xl }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
              >
                {children}
              </ScrollView>
            </GestureDetector>

            {footer && (
              <View style={[styles.footer, { backgroundColor: theme.bg, borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.md }]}>
                {footer}
              </View>
            )}
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  flex:          { flex: 1 },
  header:        { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  handle:        { width: 38, height: 4, borderRadius: 999, alignSelf: 'center', marginBottom: Spacing.md },
  headerRow:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md },
  titleWrap:     { flex: 1, minWidth: 0 },
  titleRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot:           { width: 8, height: 8, borderRadius: 999 },
  title:         { fontFamily: Fonts.displayBold, fontSize: 22, letterSpacing: -0.7, lineHeight: 26 },
  subtitle:      { fontFamily: Fonts.display, fontSize: 12.5, marginTop: 5, letterSpacing: -0.05 },
  closeBtn:      { width: 34, height: 34, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  closeText:     { fontFamily: Fonts.display, fontSize: 16 },
  scroll:        { flex: 1 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.lg },
  footer:        { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1 },
})
