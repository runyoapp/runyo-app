import { useState } from 'react'
import { View, Text, TextInput, Switch, TouchableOpacity, StyleSheet } from 'react-native'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'
import { saveUserSettings } from '@/services/settings'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

export function NotifSection() {
  const theme          = useTheme()
  const getToken       = useAuthStore(s => s.getToken)
  const telegramUser   = useSettingsStore(s => s.telegramUser)
  const notifications  = useSettingsStore(s => s.notifications)
  const setTelegram    = useSettingsStore(s => s.setTelegramUser)
  const setNotif       = useSettingsStore(s => s.setNotifications)
  const showToast      = useUiStore(s => s.showToast)

  const [tg,      setTg]      = useState(telegramUser)
  const [saving,  setSaving]  = useState(false)

  async function save() {
    const token = await getToken()
    if (!token) { showToast('Niet ingelogd'); return }
    if (!tg) { showToast('Vul je Telegram gebruikersnaam in'); return }
    setSaving(true)
    try {
      await setTelegram(tg)
      await saveUserSettings(token, tg, notifications)
      showToast('✓ Instellingen opgeslagen')
    } catch {
      showToast('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  function toggleSchema(val: boolean) {
    setNotif({ ...notifications, schema: { ...notifications.schema, enabled: val } })
  }

  function toggleFeedback(val: boolean) {
    setNotif({ ...notifications, feedback: { ...notifications.feedback, enabled: val } })
  }

  function updateTime(type: 'schema' | 'feedback', idx: number, val: string) {
    const times = [...notifications[type].times]
    times[idx] = val
    setNotif({ ...notifications, [type]: { ...notifications[type], times } })
  }

  function addTime(type: 'schema' | 'feedback') {
    const times = [...notifications[type].times, '07:00']
    setNotif({ ...notifications, [type]: { ...notifications[type], times } })
  }

  function removeTime(type: 'schema' | 'feedback', idx: number) {
    const times = notifications[type].times.filter((_, i) => i !== idx)
    setNotif({ ...notifications, [type]: { ...notifications[type], times } })
  }

  return (
    <View style={styles.container}>
      {/* Telegram */}
      <Text style={styles.label}>Telegram gebruikersnaam</Text>
      <TextInput
        style={styles.input}
        value={tg}
        onChangeText={setTg}
        placeholder="@gebruikersnaam"
        placeholderTextColor={LightTheme.faint}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.hint}>Start @runyo_appbot in Telegram om notificaties te activeren.</Text>

      {/* Schema notifications */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Trainingsschema notificaties</Text>
        <Switch
          value={notifications.schema.enabled}
          onValueChange={toggleSchema}
          trackColor={{ true: LightTheme.accent }}
          thumbColor="#fff"
        />
      </View>
      {notifications.schema.enabled && (
        <TimePickers
          times={notifications.schema.times}
          onUpdate={(i, v) => updateTime('schema', i, v)}
          onAdd={() => addTime('schema')}
          onRemove={i => removeTime('schema', i)}
        />
      )}

      {/* Feedback notifications */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Feedback notificaties</Text>
        <Switch
          value={notifications.feedback.enabled}
          onValueChange={toggleFeedback}
          trackColor={{ true: LightTheme.accent }}
          thumbColor="#fff"
        />
      </View>
      {notifications.feedback.enabled && (
        <TimePickers
          times={notifications.feedback.times}
          onUpdate={(i, v) => updateTime('feedback', i, v)}
          onAdd={() => addTime('feedback')}
          onRemove={i => removeTime('feedback', i)}
        />
      )}

      <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={save} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Opslaan…' : 'Opslaan'}</Text>
      </TouchableOpacity>
    </View>
  )
}

function TimePickers({ times, onUpdate, onAdd, onRemove }: {
  times: string[]
  onUpdate: (i: number, v: string) => void
  onAdd: () => void
  onRemove: (i: number) => void
}) {
  return (
    <View style={tpStyles.container}>
      {times.map((t, i) => (
        <View key={i} style={tpStyles.row}>
          <TextInput
            style={tpStyles.input}
            value={t}
            onChangeText={v => onUpdate(i, v)}
            placeholder="07:00"
            placeholderTextColor={LightTheme.faint}
            keyboardType="numbers-and-punctuation"
          />
          {times.length > 1 && (
            <TouchableOpacity onPress={() => onRemove(i)} style={tpStyles.removeBtn}>
              <Text style={tpStyles.removeBtnText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity onPress={onAdd} style={tpStyles.addBtn}>
        <Text style={tpStyles.addBtnText}>+ Tijd toevoegen</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { gap: Spacing.sm },
  label:       { fontFamily: Fonts.displaySemiBold, fontSize: 13, color: LightTheme.text },
  input:       { fontFamily: Fonts.display, fontSize: 14, color: LightTheme.text, backgroundColor: LightTheme.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: LightTheme.border },
  hint:        { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted, lineHeight: 16 },
  toggleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  toggleLabel: { fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text, flex: 1 },
  saveBtn:     { backgroundColor: LightTheme.accent, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: '#fff' },
})

const tpStyles = StyleSheet.create({
  container:    { gap: 6, paddingLeft: Spacing.md },
  row:          { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  input:        { fontFamily: Fonts.mono, fontSize: 14, color: LightTheme.text, backgroundColor: LightTheme.surface, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: LightTheme.border, width: 80 },
  removeBtn:    { padding: 4 },
  removeBtnText:{ fontFamily: Fonts.display, fontSize: 18, color: LightTheme.muted },
  addBtn:       { alignSelf: 'flex-start', paddingVertical: 4 },
  addBtnText:   { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.accent },
})
