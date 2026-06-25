import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'
import { saveUserSettings } from '@/services/settings'
import { getTelegramStatus, unlinkTelegram, sendTelegramTest } from '@/services/telegram'
import { Fonts } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { SectionLabel, Card, Divider, Toggle, TimeChip, AddTimeButton } from './ui'
import { TelegramMark, StatusPill } from '@/components/telegram/atoms'
import { TelegramWizard } from '@/components/telegram/TelegramWizard'

type NotifType = 'schema' | 'feedback'

// Herontwerp van de notificatie-sectie ("Hoe je je training ontvangt"): één
// kanaal-kaart met live koppel-status. Koppelen gaat via de deep-link-wizard,
// niet meer via een handmatig ingevulde gebruikersnaam.
export function NotifSection() {
  const theme          = useTheme()
  const getToken       = useAuthStore(s => s.getToken)
  const notifications  = useSettingsStore(s => s.notifications)
  const setNotif       = useSettingsStore(s => s.setNotifications)
  const showToast      = useUiStore(s => s.showToast)

  const [linked,   setLinked]   = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [testing, setTesting] = useState(false)

  async function refreshStatus() {
    try {
      const token = await getToken()
      if (!token) return
      const st = await getTelegramStatus(token)
      setLinked(st.linked)
      setUsername(st.username)
    } catch { /* status onbekend → toon 'uit' */ }
  }

  useEffect(() => { refreshStatus() }, [])

  async function save() {
    const token = await getToken()
    if (!token) { showToast('Niet ingelogd'); return }
    if (!username) { showToast('Koppel eerst Telegram'); return }
    setSaving(true)
    try {
      await saveUserSettings(token, username, notifications)
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
    } catch {
      showToast('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    const token = await getToken()
    if (!token) { showToast('Niet ingelogd'); return }
    setTesting(true)
    try {
      const ok = await sendTelegramTest(token)
      showToast(ok ? 'Testbericht verstuurd' : 'Versturen mislukt')
    } catch {
      showToast('Versturen mislukt')
    } finally {
      setTesting(false)
    }
  }

  async function unlink() {
    const token = await getToken()
    if (!token) { showToast('Niet ingelogd'); return }
    try {
      await unlinkTelegram(token)
      setLinked(false)
      setUsername(null)
      showToast('Telegram ontkoppeld')
    } catch {
      showToast('Ontkoppelen mislukt')
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
      <SectionLabel>Hoe je je training ontvangt</SectionLabel>
      <Card>
        {/* Kanaal-kop: Telegram + live status */}
        <View style={styles.channelHead}>
          <TelegramMark size={42} bg={linked ? undefined : theme.muted} />
          <View style={styles.channelLabels}>
            <Text style={[styles.channelTitle, { color: theme.text }]}>Dagelijks bericht</Text>
            <Text style={[styles.channelMeta, { color: theme.muted }]}>
              via Telegram{linked && username ? ` · @${username}` : ''}
            </Text>
          </View>
          <StatusPill t={theme} tone={linked ? 'linked' : 'idle'} label={linked ? 'gekoppeld' : 'uit'} />
        </View>

        {linked ? (
          <>
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
            <Divider />
            <ManageRow
              label="Testbericht sturen"
              sub="nu meteen, om te checken"
              actionLabel={testing ? 'Versturen…' : 'Stuur →'}
              actionColor={theme.accent}
              onPress={testing ? undefined : sendTest}
            />
            <Divider />
            <ManageRow
              label="Ontkoppelen"
              sub="stopt het dagelijkse bericht"
              actionLabel="Ontkoppel"
              actionColor={theme.danger}
              onPress={unlink}
            />

            <View style={styles.saveWrap}>
              <TouchableOpacity
                onPress={save}
                disabled={saving}
                activeOpacity={0.85}
                style={[styles.saveBtn, { backgroundColor: saved ? theme.text : theme.accent }]}
              >
                <Text style={[styles.saveText, { color: saved ? theme.bg : theme.accentInk }]}>
                  {saved ? 'Opgeslagen ✓' : saving ? 'Opslaan…' : 'Tijden opslaan'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.unlinkedBody}>
            <Text style={[styles.unlinkedText, { color: theme.muted }]}>
              Meldingen staan nog niet aan. Koppel je Telegram hier en runyo stuurt je elke ochtend de training van die dag!
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setWizardOpen(true)}
              style={[styles.koppelBtn, { backgroundColor: theme.accent }]}
            >
              <TelegramMark size={28} bg="rgba(6,32,25,0.12)" fg={theme.accentInk} />
              <Text style={[styles.koppelLabel, { color: theme.accentInk }]}>Koppel Telegram</Text>
              <Text style={[styles.koppelArrow, { color: theme.accentInk }]}>↗</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>

      {Platform.OS === 'web' && (
        <Text style={[styles.footNote, { color: theme.muted }]}>
          Push naar je telefoon werkt alleen in de runyo-app op iOS of Android.
        </Text>
      )}

      <TelegramWizard
        visible={wizardOpen}
        onClose={() => { setWizardOpen(false); refreshStatus() }}
        onLinked={refreshStatus}
      />
    </View>
  )
}

function ManageRow({ label, sub, actionLabel, actionColor, onPress }: {
  label: string
  sub: string
  actionLabel: string
  actionColor: string
  onPress?: () => void
}) {
  const theme = useTheme()
  return (
    <View style={styles.manageRow}>
      <View style={styles.flex1}>
        <Text style={[styles.manageLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.manageSub, { color: theme.muted }]}>{sub}</Text>
      </View>
      <TouchableOpacity onPress={onPress} hitSlop={8} activeOpacity={0.7}>
        <Text style={[styles.manageAction, { color: actionColor }]}>{actionLabel}</Text>
      </TouchableOpacity>
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
              <TimeChip key={i} time={t} onChange={v => onUpdate(i, v)} onRemove={() => onRemove(i)} />
            ))}
          </View>
          <AddTimeButton onPress={onAdd} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  flex1:        { flex: 1, minWidth: 0 },

  channelHead:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  channelLabels:{ flex: 1, minWidth: 0 },
  channelTitle: { fontFamily: Fonts.displaySemiBold, fontSize: 15, letterSpacing: -0.1 },
  channelMeta:  { fontFamily: Fonts.mono, fontSize: 11, marginTop: 2 },

  unlinkedBody: { paddingHorizontal: 15, paddingBottom: 16, paddingTop: 2, gap: 14 },
  unlinkedText: { fontFamily: Fonts.display, fontSize: 13, lineHeight: 19 },
  koppelBtn:    { height: 50, borderRadius: 8, paddingLeft: 11, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  koppelLabel:  { flex: 1, fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.2 },
  koppelArrow:  { fontFamily: Fonts.displaySemiBold, fontSize: 16 },

  manageRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  manageLabel:  { fontFamily: Fonts.displaySemiBold, fontSize: 14, letterSpacing: -0.1 },
  manageSub:    { fontFamily: Fonts.display, fontSize: 12, marginTop: 2 },
  manageAction: { fontFamily: Fonts.displaySemiBold, fontSize: 13 },

  block:       { padding: 14 },
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
