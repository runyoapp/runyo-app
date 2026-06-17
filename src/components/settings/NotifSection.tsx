import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'
import { saveUserSettings } from '@/services/settings'
import { Fonts } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { SectionLabel, Card, Divider, Toggle, TimeChip, AddTimeButton } from './ui'

type NotifType = 'schema' | 'feedback'

export function NotifSection() {
  const theme          = useTheme()
  const getToken       = useAuthStore(s => s.getToken)
  const telegramUser   = useSettingsStore(s => s.telegramUser)
  const notifications  = useSettingsStore(s => s.notifications)
  const setTelegram    = useSettingsStore(s => s.setTelegramUser)
  const setNotif       = useSettingsStore(s => s.setNotifications)
  const showToast      = useUiStore(s => s.showToast)

  const [tg,     setTg]     = useState(telegramUser)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  async function save() {
    const token = await getToken()
    if (!token) { showToast('Niet ingelogd'); return }
    if (!tg) { showToast('Vul je Telegram gebruikersnaam in'); return }
    setSaving(true)
    try {
      await setTelegram(tg)
      await saveUserSettings(token, tg, notifications)
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
    } catch {
      showToast('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  function toggle(type: NotifType) {
    setNotif({ ...notifications, [type]: { ...notifications[type], enabled: !notifications[type].enabled } })
  }

  function updateTime(type: NotifType, idx: number, val: string) {
    const times = [...notifications[type].times]
    times[idx] = val
    setNotif({ ...notifications, [type]: { ...notifications[type], times } })
  }

  function addTime(type: NotifType) {
    setNotif({ ...notifications, [type]: { ...notifications[type], times: [...notifications[type].times, '09:00'] } })
  }

  function removeTime(type: NotifType, idx: number) {
    const times = notifications[type].times.filter((_, i) => i !== idx)
    setNotif({ ...notifications, [type]: { ...notifications[type], times } })
  }

  return (
    <View>
      <SectionLabel>Meldingen via Telegram</SectionLabel>
      <Card>
        {/* Telegram koppeling */}
        <View style={styles.block}>
          <Text style={[styles.tgLabel, { color: theme.text }]}>Telegram gebruikersnaam</Text>
          <TextInput
            value={tg}
            onChangeText={setTg}
            placeholder="@gebruikersnaam"
            placeholderTextColor={theme.faint}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.tgInput, { backgroundColor: theme.surface2, borderColor: theme.border, color: theme.text }]}
          />
          <Text style={[styles.tgHint, { color: theme.muted }]}>
            Start <Text style={[styles.tgBot, { color: theme.text2 }]}>@runyo_appbot</Text> in Telegram om meldingen te activeren.
          </Text>
        </View>

        <Divider />
        <NotifBlock
          title="Trainingsschema"
          sub="Wat staat er vandaag op het programma"
          on={notifications.schema.enabled}
          onToggle={() => toggle('schema')}
          times={notifications.schema.times}
          onUpdate={(i, v) => updateTime('schema', i, v)}
          onAdd={() => addTime('schema')}
          onRemove={i => removeTime('schema', i)}
        />

        <Divider />
        <NotifBlock
          title="Feedback"
          sub="Hoe ging de training vandaag"
          on={notifications.feedback.enabled}
          onToggle={() => toggle('feedback')}
          times={notifications.feedback.times}
          onUpdate={(i, v) => updateTime('feedback', i, v)}
          onAdd={() => addTime('feedback')}
          onRemove={i => removeTime('feedback', i)}
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

      {Platform.OS === 'web' && (
        <Text style={[styles.footNote, { color: theme.muted }]}>
          Push naar je telefoon werkt alleen in de runyo-app op iOS of Android.
        </Text>
      )}
    </View>
  )
}

function NotifBlock({ title, sub, on, onToggle, times, onUpdate, onAdd, onRemove }: {
  title: string
  sub: string
  on: boolean
  onToggle: () => void
  times: string[]
  onUpdate: (i: number, v: string) => void
  onAdd: () => void
  onRemove: (i: number) => void
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
        <View style={styles.timesWrap}>
          <View style={styles.chips}>
            {times.map((t, i) => (
              <TimeChip
                key={i}
                time={t}
                onChange={v => onUpdate(i, v)}
                onRemove={() => onRemove(i)}
              />
            ))}
          </View>
          <AddTimeButton onPress={onAdd} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  block:       { padding: 14 },
  tgLabel:     { fontFamily: Fonts.displaySemiBold, fontSize: 14.5, letterSpacing: -0.1, marginBottom: 9 },
  tgInput:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, fontFamily: Fonts.mono, fontSize: 14 },
  tgHint:      { fontFamily: Fonts.display, fontSize: 12, marginTop: 8, lineHeight: 17 },
  tgBot:       { fontFamily: Fonts.mono, fontSize: 11.5 },

  blockHead:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  blockLabels: { flex: 1, minWidth: 0 },
  blockTitle:  { fontFamily: Fonts.displaySemiBold, fontSize: 14.5, letterSpacing: -0.1 },
  blockSub:    { fontFamily: Fonts.display, fontSize: 12, marginTop: 2 },
  timesWrap:   { marginTop: 12 },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  saveWrap:    { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  saveBtn:     { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveText:    { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.1 },

  footNote:    { fontFamily: Fonts.display, fontSize: 12, paddingHorizontal: 6, paddingTop: 9, lineHeight: 17 },
})
