import { useEffect, useState } from 'react'
import { View, Text, Switch, TouchableOpacity, TextInput, StyleSheet } from 'react-native'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { registerForPushNotifications, loadPushPrefs, savePushPrefs, openNotificationSettings } from '@/services/pushNotifications'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'

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
  const getToken  = useAuthStore(s => s.getToken)
  const showToast = useUiStore(s => s.showToast)

  const [status,  setStatus]  = useState<'idle' | 'granted' | 'denied'>('idle')
  const [prefs,   setPrefs]   = useState<Prefs>(DEFAULTS)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    async function init() {
      const result = await registerForPushNotifications(getToken)
      if (!result.granted) {
        setStatus('denied')
        return
      }
      setStatus('granted')
      const loaded = await loadPushPrefs(getToken)
      if (loaded) setPrefs(loaded)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true)
    try {
      await savePushPrefs(getToken, prefs)
      showToast('✓ Push-instellingen opgeslagen')
    } catch {
      showToast('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'idle') return null

  if (status === 'denied') {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Push notificaties</Text>
        <Text style={styles.deniedText}>
          runyo heeft geen toestemming voor push notificaties. Geef toestemming via je apparaatinstellingen.
        </Text>
        <TouchableOpacity style={styles.openSettingsBtn} onPress={openNotificationSettings}>
          <Text style={styles.openSettingsBtnText}>Open instellingen</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Push notificaties</Text>

      <View style={styles.toggleRow}>
        <View style={styles.toggleLabelGroup}>
          <Text style={styles.toggleLabel}>Training vandaag</Text>
          <Text style={styles.toggleSub}>Ochtendreminder met je dagschema</Text>
        </View>
        <Switch
          value={prefs.vandaagEnabled}
          onValueChange={v => setPrefs(p => ({ ...p, vandaagEnabled: v }))}
          trackColor={{ true: LightTheme.accent }}
          thumbColor="#fff"
        />
      </View>
      {prefs.vandaagEnabled && (
        <TextInput
          style={styles.timeInput}
          value={prefs.vandaagTime}
          onChangeText={v => setPrefs(p => ({ ...p, vandaagTime: v }))}
          placeholder="07:00"
          placeholderTextColor={LightTheme.faint}
          keyboardType="numbers-and-punctuation"
        />
      )}

      <View style={styles.toggleRow}>
        <View style={styles.toggleLabelGroup}>
          <Text style={styles.toggleLabel}>Training morgen</Text>
          <Text style={styles.toggleSub}>Avondpreview van je training van morgen</Text>
        </View>
        <Switch
          value={prefs.morgenEnabled}
          onValueChange={v => setPrefs(p => ({ ...p, morgenEnabled: v }))}
          trackColor={{ true: LightTheme.accent }}
          thumbColor="#fff"
        />
      </View>
      {prefs.morgenEnabled && (
        <TextInput
          style={styles.timeInput}
          value={prefs.morgenTime}
          onChangeText={v => setPrefs(p => ({ ...p, morgenTime: v }))}
          placeholder="20:00"
          placeholderTextColor={LightTheme.faint}
          keyboardType="numbers-and-punctuation"
        />
      )}

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={save}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Opslaan…' : 'Opslaan'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container:        { gap: Spacing.sm },
  sectionTitle:     { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: LightTheme.text, marginBottom: 2 },
  deniedText:       { fontFamily: Fonts.display, fontSize: 13, color: LightTheme.muted, lineHeight: 20 },
  openSettingsBtn:  { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: Radius.sm, borderWidth: 1, borderColor: LightTheme.accent, marginTop: 4 },
  openSettingsBtnText: { fontFamily: Fonts.displaySemiBold, fontSize: 13, color: LightTheme.accent },
  toggleRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  toggleLabelGroup: { flex: 1, marginRight: Spacing.sm },
  toggleLabel:      { fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text },
  toggleSub:        { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted, marginTop: 2 },
  timeInput:        { fontFamily: Fonts.mono, fontSize: 14, color: LightTheme.text, backgroundColor: LightTheme.surface, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: LightTheme.border, width: 80, marginLeft: Spacing.md },
  saveBtn:          { backgroundColor: LightTheme.accent, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnDisabled:  { opacity: 0.5 },
  saveBtnText:      { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: '#fff' },
})
