import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { Fonts } from '@/constants/theme'
import type { Theme } from '@/constants/theme'

// runyo v4 — gedeelde Telegram-atomen (activatie-funnel).
// Mint Stride-tokens via de meegegeven Theme; alleen het Telegram-merkblauw is
// vast (voor het vliegertje), nooit als vlak.

export const TG_BLUE = '#229ED9'
const AMBER = '#E0A82E'

// Paper-plane in een cirkel — merkblauw of (uit) gedimd.
export function TelegramMark({ size = 40, bg = TG_BLUE, fg = '#fff' }: { size?: number; bg?: string; fg?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 999, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
        <Path
          d="M21.5 4.2 2.9 11.3c-1 .4-1 1.8 0 2.1l4.6 1.5 1.8 5.4c.3.8 1.3 1 1.9.4l2.5-2.4 4.6 3.4c.7.5 1.7.1 1.9-.7l3.1-15c.2-1-.8-1.8-1.8-1.3Z"
          fill={fg}
        />
      </Svg>
    </View>
  )
}

export type StatusTone = 'idle' | 'waiting' | 'linked' | 'error'

export function StatusPill({ t, tone, label }: { t: Theme; tone: StatusTone; label: string }) {
  const map: Record<StatusTone, string> = {
    idle: t.muted,
    waiting: AMBER,
    linked: t.accent,
    error: t.danger,
  }
  const c = map[tone]
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (tone !== 'waiting') return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [tone])

  return (
    <View style={[s.pill, { backgroundColor: c + '20' }]}>
      <Animated.View style={[s.pillDot, { backgroundColor: c, opacity: tone === 'waiting' ? pulse : 1 }]} />
      <Text style={[s.pillText, { color: c }]}>{label}</Text>
    </View>
  )
}

// Grote mint vink-cirkel (zelfde taal als de import 'Klaar'-stap).
export function SuccessCheck({ t, size = 76 }: { t: Theme; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 999, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size * 0.45} height={size * 0.45} viewBox="0 0 34 34">
        <Path d="M9 17.5l5 5 11-12" stroke={t.accentInk} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  )
}

// Voorbeeld van het ochtendbericht — exact de opmaak die de bot stuurt (zoals je
// 'm krijgt bij /vandaag): kop met type-emoji + bold type · titel, km-regel, en de
// omschrijving in een blockquote. Eén tik koppelt het.
export function DailyMessagePreview({ t }: { t: Theme }) {
  return (
    <View style={[s.preview, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={[s.previewHead, { borderBottomColor: t.border }]}>
        <TelegramMark size={34} />
        <View style={s.flex1}>
          <Text style={[s.previewName, { color: t.text }]}>runyo</Text>
          <Text style={[s.previewMeta, { color: t.muted }]}>via Telegram · 07:00</Text>
        </View>
        <View style={[s.previewDot, { backgroundColor: t.accent }]} />
      </View>
      <View style={[s.bubble, { backgroundColor: t.bg }]}>
        <Text style={[s.bubbleText, { color: t.text }]}>
          🌅 <Text style={s.bubbleBold}>Goedemorgen!</Text>
        </Text>
        <Text style={[s.bubbleText, { color: t.text, marginTop: 9 }]}>
          🏃 <Text style={s.bubbleBold}>Hardlopen</Text> · Tempoloop
        </Text>
        <Text style={[s.bubbleText, { color: t.text }]}>
          📏 <Text style={s.bubbleBold}>8 km</Text>
        </Text>
        <View style={[s.bubbleQuote, { borderLeftColor: t.accent }]}>
          <Text style={[s.bubbleQuoteText, { color: t.muted }]}>
            5 km rustig inlopen, dan 3 km op halve-marathontempo
          </Text>
        </View>
        <Text style={[s.bubbleItalic, { color: t.muted, marginTop: 9 }]}>
          Beoordeel je dag met /feedback
        </Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5, paddingLeft: 9, paddingRight: 11, borderRadius: 999, alignSelf: 'flex-start' },
  pillDot: { width: 7, height: 7, borderRadius: 999 },
  pillText: { fontFamily: Fonts.monoMedium, fontSize: 11, letterSpacing: 0.1 },

  preview: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 11, borderBottomWidth: 1 },
  previewName: { fontFamily: Fonts.displaySemiBold, fontSize: 13.5, letterSpacing: -0.1 },
  previewMeta: { fontFamily: Fonts.mono, fontSize: 10.5, marginTop: 1 },
  previewDot: { width: 7, height: 7, borderRadius: 999 },
  bubble: { alignSelf: 'flex-start', maxWidth: '92%', borderRadius: 14, borderTopLeftRadius: 4, paddingVertical: 11, paddingHorizontal: 13 },
  bubbleText: { fontFamily: Fonts.display, fontSize: 13, lineHeight: 19.5 },
  bubbleBold: { fontFamily: Fonts.displaySemiBold },
  bubbleItalic: { fontFamily: Fonts.display, fontSize: 12.5, fontStyle: 'italic', lineHeight: 18 },
  bubbleQuote: { borderLeftWidth: 3, paddingLeft: 10, marginTop: 9 },
  bubbleQuoteText: { fontFamily: Fonts.display, fontSize: 12.5, lineHeight: 18 },
})
