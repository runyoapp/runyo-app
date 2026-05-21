import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { syncActivitiesToSheet } from '@/services/sheets'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

export function SheetsSyncSection() {
  const theme      = useTheme()
  const getToken   = useAuthStore(s => s.getToken)
  const sheetId    = useDataStore(s => s.sheetId)
  const tabName    = useDataStore(s => s.tabName)
  const activities = useDataStore(s => s.activities)
  const showToast  = useUiStore(s => s.showToast)

  const [syncing,  setSyncing]  = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  if (!sheetId) return null

  async function handleSync() {
    if (!sheetId) return
    setSyncing(true)
    try {
      const token = await getToken()
      if (!token) { showToast('Niet ingelogd'); return }
      const { synced } = await syncActivitiesToSheet(sheetId, tabName, token, activities)
      setLastSync(new Date())
      showToast(`✓ ${synced} activiteiten gesynchroniseerd`)
    } catch {
      showToast('Synchronisatie mislukt')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.desc, { color: theme.muted }]}>
        Schrijf alle activiteiten uit de app terug naar je gekoppelde Google Sheet.
      </Text>
      {lastSync && (
        <Text style={[styles.lastSync, { color: theme.faint }]}>
          Laatste sync: {lastSync.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
      <TouchableOpacity
        style={[styles.btn, syncing && styles.btnDisabled]}
        onPress={handleSync}
        disabled={syncing}
        activeOpacity={0.8}
      >
        <Text style={styles.btnText}>{syncing ? 'Bezig…' : 'Synchroniseer naar Sheets'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { gap: Spacing.sm },
  desc:        { fontFamily: Fonts.display, fontSize: 13, color: LightTheme.muted, lineHeight: 20 },
  lastSync:    { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.faint },
  btn:         { backgroundColor: LightTheme.accent, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText:     { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: '#fff' },
})
