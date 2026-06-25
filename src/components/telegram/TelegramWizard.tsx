import { useEffect, useRef, useState } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking, Animated, Easing, Platform } from 'react-native'
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context'
import { Fonts, type Theme } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { goToToday } from '@/navigation/navigationRef'
import { createTelegramLink, getTelegramStatus } from '@/services/telegram'
import { StepHead, HintRow } from '@/screens/import/components/atoms'
import { TelegramMark, StatusPill, SuccessCheck, DailyMessagePreview } from './atoms'

// runyo v4 — Telegram-koppelwizard (activatie-funnel).
// idle (deep-link aanbod) → waiting (pollt op bevestiging) → linked ✓
// + timeout (niet teruggekomen) en error (token maken mislukt) + overslaan-sheet.

type WizardState = 'idle' | 'waiting' | 'linked' | 'timeout' | 'error'

const BOT = '@runyo_appbot'
const POLL_MS = 3000
const WAIT_TIMEOUT_MS = 90_000

// Open de deep-link. Op web in een NIEUW tabblad (de app-tab blijft staan en
// pollt door, dus je hoeft het Telegram-tabblad niet te sluiten om terug te
// keren); we proberen daarna de app-tab weer naar voren te halen (browser mag
// dit negeren). Op native gewoon via Linking (Telegram-app opent eroverheen).
function openDeepLink(url: string) {
  if (Platform.OS === 'web') {
    try {
      window.open(url, '_blank', 'noopener,noreferrer')
      window.focus()
    } catch { /* popup geblokkeerd → val terug op Linking */ Linking.openURL(url).catch(() => {}) }
    return
  }
  Linking.openURL(url).catch(() => {})
}

type Props = {
  visible: boolean
  onClose: () => void
  onLinked?: () => void
}

export function TelegramWizard({ visible, onClose, onLinked }: Props) {
  const insets   = useSafeAreaInsets()
  const t        = useTheme()
  const getToken = useAuthStore(s => s.getToken)
  const showToast = useUiStore(s => s.showToast)

  const [state, setState] = useState<WizardState>('idle')
  const waitStart = useRef(0)

  // Bij (her)openen terug naar de begintoestand.
  useEffect(() => {
    if (visible) { setState('idle') }
  }, [visible])

  // Pollen zolang we wachten: zodra de bot de chat koppelt → linked.
  useEffect(() => {
    if (state !== 'waiting') return
    let cancelled = false
    const id = setInterval(async () => {
      try {
        const tk = await getToken()
        if (!tk || cancelled) return
        const st = await getTelegramStatus(tk)
        if (cancelled) return
        if (st.linked) { setState('linked'); onLinked?.() }
        else if (Date.now() - waitStart.current > WAIT_TIMEOUT_MS) setState('timeout')
      } catch { /* tijdelijk — volgende tick probeert opnieuw */ }
    }, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [state])

  async function openTelegram() {
    try {
      const tk = await getToken()
      if (!tk) { showToast('Niet ingelogd'); return }
      const link = await createTelegramLink(tk)
      waitStart.current = Date.now()
      setState('waiting')
      openDeepLink(link.url)
    } catch {
      setState('error')
    }
  }

  // Klaar → sluit de wizard én spring naar de Vandaag-tab (niet terug naar
  // Instellingen, waar de wizard vandaan kwam).
  function done() {
    onClose()
    goToToday()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
        {/* Bovenbalk: sluiten */}
        <View style={styles.topBar}>
          <View style={styles.flex1} />
          <TouchableOpacity onPress={onClose} hitSlop={10}
            style={[styles.closeBtn, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.closeX, { color: t.muted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {state === 'idle' && <IdleView t={t} onOpen={openTelegram} onSkip={onClose} insets={insets} />}
        {(state === 'waiting' || state === 'timeout') && (
          <WaitingView t={t} timedOut={state === 'timeout'} onRetry={openTelegram}
            onSkip={onClose} insets={insets} />
        )}
        {state === 'linked' && <LinkedView t={t} onContinue={done} insets={insets} />}
        {state === 'error' && <ErrorView t={t} onRetry={openTelegram} onSkip={onClose} insets={insets} />}
      </View>
    </Modal>
  )
}

// ── Deep-link knop (accent, Telegram-vlieger links) ───────────────────────────
function DeepLinkBtn({ t, label, onPress }: { t: Theme; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}
      style={[styles.deepBtn, { backgroundColor: t.accent }]}>
      <TelegramMark size={30} bg="rgba(6,32,25,0.12)" fg={t.accentInk} />
      <Text style={[styles.deepLabel, { color: t.accentInk }]}>{label}</Text>
      <Text style={[styles.deepArrow, { color: t.accentInk }]}>↗</Text>
    </TouchableOpacity>
  )
}

// ── idle ──────────────────────────────────────────────────────────────────────
function IdleView({ t, onOpen, onSkip, insets }: { t: Theme; onOpen: () => void; onSkip: () => void; insets: EdgeInsets }) {
  return (
    <View style={styles.flex1}>
      <View style={styles.body}>
        <StepHead t={t} title="Zet je dagelijkse bericht aan"
          sub="runyo stuurt je elke ochtend de training van die dag via Telegram. Eén tik koppelt het — geen gebruikersnaam invullen." />
        <View style={styles.pad}>
          <DailyMessagePreview t={t} />
          <View style={[styles.botRow, { backgroundColor: t.surface2 }]}>
            <Text style={[styles.botHandle, { color: t.text2 }]}>{BOT}</Text>
            <View style={styles.flex1} />
            <StatusPill t={t} tone="idle" label="nog niet gekoppeld" />
          </View>
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <DeepLinkBtn t={t} label="Open Telegram en koppel" onPress={onOpen} />
        <Text style={[styles.footHint, { color: t.muted }]}>
          Liever later?{' '}
          <Text onPress={onSkip} style={[styles.footLink, { color: t.text }]}>Sla over</Text>
          {' '}— je zet 'm later aan in je profiel.
        </Text>
      </View>
    </View>
  )
}

// ── waiting / timeout ─────────────────────────────────────────────────────────
function WaitingView({ t, timedOut, onRetry, onSkip, insets }: {
  t: Theme; timedOut: boolean; onRetry: () => void; onSkip: () => void; insets: EdgeInsets
}) {
  const pulse = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (timedOut) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [timedOut])

  return (
    <View style={styles.flex1}>
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ scale: timedOut ? 1 : pulse }] }}>
          <TelegramMark size={72} bg={timedOut ? t.muted : undefined} />
        </Animated.View>
        <Text style={[styles.centerTitle, { color: t.text }]}>
          {timedOut ? 'Nog niets binnengekomen' : 'We wachten op Telegram'}
        </Text>
        <Text style={[styles.centerText, { color: t.muted }]}>
          {timedOut
            ? 'Het kan even duren. Open Telegram opnieuw en tik op Starten.'
            : 'Tik in Telegram op Starten. Zodra dat gebeurd is springt dit vanzelf op groen — ook als je deze app even sluit.'}
        </Text>
        <View style={{ marginTop: 18 }}>
          <StatusPill t={t} tone={timedOut ? 'idle' : 'waiting'} label={timedOut ? 'onderbroken' : 'verbinden…'} />
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <DeepLinkBtn t={t} label="Telegram opnieuw openen" onPress={onRetry} />
        <Text style={[styles.footHint, { color: t.muted }]}>
          <Text onPress={onSkip} style={[styles.footLink, { color: t.text }]}>Doe het later</Text>
        </Text>
      </View>
    </View>
  )
}

// ── linked ────────────────────────────────────────────────────────────────────
function LinkedView({ t, onContinue, insets }: { t: Theme; onContinue: () => void; insets: EdgeInsets }) {
  return (
    <View style={styles.flex1}>
      <View style={styles.center}>
        <SuccessCheck t={t} />
        <Text style={[styles.centerTitle, { color: t.text }]}>Telegram gekoppeld</Text>
        <Text style={[styles.centerText, { color: t.muted }]}>
          Je eerste bericht komt morgenochtend om 07:00. Aan- en uitzetten kan altijd in je profiel.
        </Text>
        <View style={[styles.linkedRow, { backgroundColor: t.surface, borderColor: t.border }]}>
          <TelegramMark size={34} />
          <View style={styles.flex1}>
            <Text style={[styles.linkedName, { color: t.text }]}>Telegram</Text>
            <Text style={[styles.linkedMeta, { color: t.muted }]}>dagelijks bericht</Text>
          </View>
          <StatusPill t={t} tone="linked" label="actief" />
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity activeOpacity={0.85} onPress={onContinue}
          style={[styles.primaryBtn, { backgroundColor: t.accent }]}>
          <Text style={[styles.primaryLabel, { color: t.accentInk }]}>Naar vandaag</Text>
          <Text style={[styles.primaryArrow, { color: t.accentInk }]}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── error ─────────────────────────────────────────────────────────────────────
function ErrorView({ t, onRetry, onSkip, insets }: { t: Theme; onRetry: () => void; onSkip: () => void; insets: EdgeInsets }) {
  return (
    <View style={styles.flex1}>
      <View style={styles.body}>
        <StepHead t={t} title="Even niet gelukt"
          sub="We konden de koppel-link niet maken. Controleer je verbinding en probeer het opnieuw." />
        <View style={styles.pad}>
          <HintRow t={t} tone="error">Lukt het daarna nog niet? Mail ons via info@runyo.app — samen komen we eruit.</HintRow>
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity activeOpacity={0.85} onPress={onRetry}
          style={[styles.primaryBtn, { backgroundColor: t.accent }]}>
          <Text style={[styles.primaryLabel, { color: t.accentInk }]}>Opnieuw proberen</Text>
          <Text style={[styles.primaryArrow, { color: t.accentInk }]}>→</Text>
        </TouchableOpacity>
        <Text style={[styles.footHint, { color: t.muted }]}>
          <Text onPress={onSkip} style={[styles.footLink, { color: t.text }]}>Doe het later</Text>
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1, minWidth: 0 },
  topBar: { height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  closeBtn: { width: 34, height: 34, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  closeX: { fontFamily: Fonts.display, fontSize: 16 },

  body: { flex: 1 },
  pad: { paddingHorizontal: 20, paddingTop: 18, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  centerTitle: { fontFamily: Fonts.displayBold, fontSize: 22, letterSpacing: -0.6, marginTop: 24, textAlign: 'center' },
  centerText: { fontFamily: Fonts.display, fontSize: 13.5, lineHeight: 20, marginTop: 9, textAlign: 'center', maxWidth: 290 },

  botRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 10 },
  botHandle: { fontFamily: Fonts.mono, fontSize: 11.5 },

  linkedRow: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 15, marginTop: 22, alignSelf: 'stretch' },
  linkedName: { fontFamily: Fonts.displaySemiBold, fontSize: 14 },
  linkedMeta: { fontFamily: Fonts.mono, fontSize: 11, marginTop: 2 },

  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  footHint: { fontFamily: Fonts.display, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  footLink: { fontFamily: Fonts.displaySemiBold, textDecorationLine: 'underline' },

  deepBtn: { height: 52, borderRadius: 8, paddingLeft: 12, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  deepLabel: { flex: 1, fontFamily: Fonts.displayBold, fontSize: 15.5, letterSpacing: -0.2 },
  deepArrow: { fontFamily: Fonts.displaySemiBold, fontSize: 17 },

  primaryBtn: { height: 52, borderRadius: 8, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryLabel: { fontFamily: Fonts.displayBold, fontSize: 15.5, letterSpacing: -0.2 },
  primaryArrow: { fontFamily: Fonts.displaySemiBold, fontSize: 17 },
})
