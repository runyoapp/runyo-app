import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Platform } from 'react-native'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { registerForPushNotifications, loadPushPrefs, savePushPrefs, openNotificationSettings } from '@/services/pushNotifications'
import { Fonts } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { SectionLabel, Card, Divider, Toggle } from './ui'

type Prefs = {
  vandaagEnabled: boolean
  vandaagTime: string
  morgenEnabled: boolean
  morgenTime: string
}

const DEFAULTS: Prefs = {
  vandaagEnabled: true,
  vandaagTime: '07:00',
  morgenEnabled: true,
  morgenTime: '20:00',
}

export function PushSection() {
  // Op web tonen we geen push-UI; de note staat in de Telegram-sectie.
  if (Platform.OS === 'web') return null
  return <PushSectionNative />
}

function PushSectionNative() {
  const theme     = useTheme()
  const getToken  = useAuthStore(s => s.getToken)
  const showToast = useUiStore(s => s.showToast)

  const [status, setStatus] = useState<'idle' | 'granted' | 'denied'>('idle')
  const [prefs,  setPrefs]  = useState<Prefs>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    async function init() {
      const result = await registerForPushNotifications(getToken)
      if (!result.granted) { setStatus('denied'); return }
      setStatus('granted')
      const loaded = await loadPushPrefs(getToken)
      if (loaded) setPrefs(loaded)
    }
    init()
  }, [])

  async function save() {
    setSaving(true)
    try {
      await savePushPrefs(getToken, prefs)
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
    } catch {
      showToast('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'idle') return null

  if (status === 'denied') {
    return (
      <View>
        <SectionLabel>Push notificaties</SectionLabel>
        <Card style={styles.pad}>
          <Text style={[styles.denied, { color: theme.muted }]}>
            runyo heeft geen toestemming voor push notificaties. Geef toestemming via je apparaatinstellingen.
          </Text>
          <TouchableOpacity style={[styles.openBtn, { borderColor: theme.accent }]} onPress={openNotificationSettings} activeOpacity={0.7}>
            <Text style={[styles.openBtnText, { color: theme.accent }]}>Open instellingen</Text>
          </TouchableOpacity>
        </Card>
      </View>
    )
  }

  return (
    <View>
      <SectionLabel>Push notificaties</SectionLabel>
      <Card>
        <PushBlock
          title="Training vandaag"
          sub="Ochtendreminder met je dagschema"
          on={prefs.vandaagEnabled}
          onToggle={() => setPrefs(p => ({ ...p, vandaagEnabled: !p.vandaagEnabled }))}
          time={prefs.vandaagTime}
          onTime={v => setPrefs(p => ({ ...p, vandaagTime: v }))}
        />
        <Divider />
        <PushBlock
          title="Training morgen"
          sub="Avondpreview van je training van morgen"
          on={prefs.morgenEnabled}
          onToggle={() => setPrefs(p => ({ ...p, morgenEnabled: !p.morgenEnabled }))}
          time={prefs.morgenTime}
          onTime={v => setPrefs(p => ({ ...p, morgenTime: v }))}
        />
        <View style={styles.saveWrap}>
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
            style={[styles.saveBtn, { backgroundColor: saved ? theme.text : theme.accent }]}
          >
            <Text style={[styles.saveText, { color: saved ? theme.bg : theme.accentInk }]}>
              {saved ? 'Opgeslagen ✓' : saving ? 'Opslaan…' : 'Opslaan'}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    </View>
  )
}

function PushBlock({ title, sub, on, onToggle, time, onTime }: {
  title: string
  sub: string
  on: boolean
  onToggle: () => void
  time: string
  onTime: (v: string) => void
}) {
  const theme = useTheme()
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <View style={styles.blockLabels}>
          <Text style={[styles.blockTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.blockSub, { color: theme.muted }]}>{sub}</Text>
        </View>
        <Toggle on={on} onToggle={onToggle} />
      </View>
      {on && (
        <View style={[styles.chip, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
          <TextInput
            value={time}
            onChangeText={onTime}
            placeholder="07:00"
            placeholderTextColor={theme.faint}
            keyboardType="numbers-and-punctuation"
            style={[styles.chipInput, { color: theme.text }]}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  pad:        { padding: 14 },
  denied:     { fontFamily: Fonts.display, fontSize: 13, lineHeight: 20 },
  openBtn:    { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, marginTop: 10 },
  openBtnText:{ fontFamily: Fonts.displaySemiBold, fontSize: 13 },

  block:      { padding: 14 },
  blockHead:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  blockLabels:{ flex: 1, minWidth: 0 },
  blockTitle: { fontFamily: Fonts.displaySemiBold, fontSize: 14.5, letterSpacing: -0.1 },
  blockSub:   { fontFamily: Fonts.display, fontSize: 12, marginTop: 2 },
  chip:       { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, height: 40, justifyContent: 'center', marginTop: 12 },
  chipInput:  { fontFamily: Fonts.mono, fontSize: 15, letterSpacing: 0.3, padding: 0, minWidth: 56 },

  saveWrap:   { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  saveBtn:    { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveText:   { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.1 },
})
