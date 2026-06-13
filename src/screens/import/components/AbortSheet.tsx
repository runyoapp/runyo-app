// runyo — "Import afbreken?"-bevestiging (bottom-sheet over de wizard heen).

import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native'
import { Fonts } from '@/constants/theme'
import type { Theme } from '@/constants/theme'

export function AbortSheet({
  t, onContinue, onAbort,
}: {
  t: Theme; onContinue: () => void; onAbort: () => void
}) {
  return (
    <View style={s.overlay}>
      <Pressable style={s.scrim} onPress={onContinue} />
      <View style={[s.sheet, { backgroundColor: t.bg }]}>
        <Text style={[s.title, { color: t.text }]}>Import afbreken?</Text>
        <Text style={[s.body, { color: t.muted }]}>
          Je raakt je gekozen bron en instellingen kwijt. Je schema wordt niet opgeslagen.
        </Text>
        <TouchableOpacity activeOpacity={0.85} onPress={onContinue} style={[s.primary, { backgroundColor: t.accent }]}>
          <Text style={[s.primaryTxt, { color: t.accentInk }]}>Doorgaan met import</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.6} onPress={onAbort} style={s.abort}>
          <Text style={[s.abortTxt, { color: t.danger }]}>Afbreken</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 10 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,31,26,0.45)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 24 },
  title: { fontFamily: Fonts.displayBold, fontSize: 19, letterSpacing: -0.4 },
  body: { fontFamily: Fonts.display, fontSize: 13.5, marginTop: 7, lineHeight: 20 },
  primary: { height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryTxt: { fontFamily: Fonts.displayBold, fontSize: 15 },
  abort: { height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  abortTxt: { fontFamily: Fonts.displaySemiBold, fontSize: 14 },
})
