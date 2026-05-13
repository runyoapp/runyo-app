import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { listRecentSheets, createNewSheet } from '@/services/drive'
import { getSheetTabId, verifyOrFixHeaders } from '@/services/sheets'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import type { SchemaEntry } from '@/types/auth'

export function ConnectSection() {
  const getToken    = useAuthStore(s => s.getToken)
  const tokenSet    = useAuthStore(s => s.tokenSet)
  const sheetId     = useDataStore(s => s.sheetId)
  const sheetFileName = useDataStore(s => s.sheetFileName)
  const tabName     = useDataStore(s => s.tabName)
  const setSchema   = useDataStore(s => s.setSchema)
  const clearSchema = useDataStore(s => s.clearSchema)
  const showToast   = useUiStore(s => s.showToast)

  const [sheets,   setSheets]   = useState<SchemaEntry[]>([])
  const [loading,  setLoading]  = useState(false)
  const [creating, setCreating] = useState(false)
  const [browsing, setBrowsing] = useState(false)

  const isSignedIn  = !!tokenSet
  const isConnected = isSignedIn && !!sheetId

  async function loadSheets() {
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const list = await listRecentSheets(token)
      setSheets(list)
    } catch {
      showToast('Kon sheets niet laden')
    } finally {
      setLoading(false)
    }
  }

  async function linkSheet(entry: SchemaEntry) {
    const token = await getToken()
    if (!token) return
    showToast('Schema koppelen…')
    try {
      const tabId = await getSheetTabId(entry.id, 'Schema', token)
        .catch(() => 0)
      await verifyOrFixHeaders(entry.id, 'Schema', token).catch(() => {})
      await setSchema(entry.id, 'Schema', entry.name, tabId)
      setBrowsing(false)
      showToast(`✓ ${entry.name} gekoppeld`)
    } catch {
      showToast('Koppelen mislukt')
    }
  }

  async function handleCreateNew() {
    const token = await getToken()
    if (!token) return
    setCreating(true)
    try {
      const entry = await createNewSheet(token, 'runyo schema')
      await verifyOrFixHeaders(entry.id, 'Schema', token)
      await setSchema(entry.id, 'Schema', entry.name, 0)
      showToast(`✓ Nieuw schema aangemaakt`)
    } catch {
      showToast('Aanmaken mislukt')
    } finally {
      setCreating(false)
    }
  }

  // Connected state
  if (isConnected) {
    return (
      <View>
        <View style={styles.connectedRow}>
          <View style={styles.greenDot} />
          <View style={styles.connectedInfo}>
            <Text style={styles.fileName}>{sheetFileName ?? 'Schema'}</Text>
            <Text style={styles.tabName}>Tab: {tabName}</Text>
          </View>
          <TouchableOpacity onPress={() => clearSchema()} style={styles.disconnectBtn}>
            <Text style={styles.disconnectText}>Ontkoppelen</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => { setBrowsing(b => !b); if (!browsing) loadSheets() }}
          >
            <Text style={styles.secondaryBtnText}>Ander schema</Text>
          </TouchableOpacity>
        </View>
        {browsing && <SchemaBrowser sheets={sheets} loading={loading} onSelect={linkSheet} />}
      </View>
    )
  }

  // Signed in, no sheet
  if (isSignedIn) {
    return (
      <View>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => { setBrowsing(b => !b); if (!browsing) loadSheets() }}
        >
          <Text style={styles.primaryBtnText}>Koppel Google Sheets schema</Text>
        </TouchableOpacity>
        {browsing && <SchemaBrowser sheets={sheets} loading={loading} onSelect={linkSheet} />}
        <TouchableOpacity
          style={[styles.secondaryBtn, { marginTop: Spacing.sm }]}
          onPress={handleCreateNew}
          disabled={creating}
        >
          <Text style={styles.secondaryBtnText}>
            {creating ? 'Aanmaken…' : '+ Leeg schema aanmaken'}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Not signed in
  return (
    <Text style={styles.hint}>Log eerst in om een schema te koppelen.</Text>
  )
}

function SchemaBrowser({
  sheets, loading, onSelect,
}: { sheets: SchemaEntry[]; loading: boolean; onSelect: (s: SchemaEntry) => void }) {
  if (loading) return <ActivityIndicator color={LightTheme.accent} style={{ marginTop: Spacing.md }} />
  if (!sheets.length) return <Text style={styles.emptyText}>Geen sheets gevonden.</Text>

  return (
    <View style={styles.browser}>
      {sheets.map(s => (
        <TouchableOpacity key={s.id} style={styles.sheetRow} onPress={() => onSelect(s)}>
          <Text style={styles.sheetName}>{s.name}</Text>
          <Text style={styles.sheetChevron}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  connectedRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  greenDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: LightTheme.accent, flexShrink: 0 },
  connectedInfo:   { flex: 1 },
  fileName:        { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: LightTheme.text },
  tabName:         { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted, marginTop: 2 },
  disconnectBtn:   { padding: Spacing.sm },
  disconnectText:  { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.muted, textDecorationLine: 'underline' },
  btnRow:          { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  primaryBtn:      { backgroundColor: LightTheme.accent, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  primaryBtnText:  { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: '#fff' },
  secondaryBtn:    { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: LightTheme.border },
  secondaryBtnText:{ fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.text },
  browser:         { marginTop: Spacing.md, borderRadius: Radius.md, overflow: 'hidden', borderWidth: 1, borderColor: LightTheme.border },
  sheetRow:        { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: LightTheme.border, backgroundColor: LightTheme.surface },
  sheetName:       { flex: 1, fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text },
  sheetChevron:    { fontFamily: Fonts.display, fontSize: 18, color: LightTheme.faint },
  hint:            { fontFamily: Fonts.display, fontSize: 13, color: LightTheme.muted },
  emptyText:       { fontFamily: Fonts.mono, fontSize: 12, color: LightTheme.muted, marginTop: Spacing.md },
})
