import { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { listRecentSheets, createNewSheet, todaySchemaName } from '@/services/drive'
import { getSheetTabId, verifyOrFixHeaders, syncActivitiesToSheet } from '@/services/sheets'
import { ImportModal } from '@/screens/ImportModal'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import type { SchemaEntry } from '@/types/auth'

// ── Connect tile — matches PWA .connect-tile exactly ──────────────────────

type TileProps = {
  primary?: boolean
  icon: string
  title: string
  badge?: string
  sub: string
  onPress: () => void
}

function ConnectTile({ primary, icon, title, badge, sub, onPress }: TileProps) {
  return (
    <TouchableOpacity
      style={[styles.tile, primary && styles.tilePrimary]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.tileIcon, primary && styles.tileIconPrimary]}>
        <Text style={styles.tileIconText}>{icon}</Text>
      </View>
      <View style={styles.tileBody}>
        <View style={styles.tileTitleRow}>
          <Text style={[styles.tileTitle, primary && styles.tileTitlePrimary]}>{title}</Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.tileSub, primary && styles.tileSubPrimary]}>{sub}</Text>
      </View>
      <Text style={[styles.tileChevron, primary && styles.tileChevronPrimary]}>›</Text>
    </TouchableOpacity>
  )
}

// ── Sheet browser (for "Gekoppelde schema's") ──────────────────────────────

function SchemaBrowser({ onSelect }: { onSelect: (s: SchemaEntry) => void }) {
  const getToken = useAuthStore(s => s.getToken)
  const [sheets,  setSheets]  = useState<SchemaEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded,  setLoaded]  = useState(false)

  async function load() {
    if (loaded) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      setSheets(await listRecentSheets(token))
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  // Auto-load on mount
  if (!loaded && !loading) load()

  if (loading) return <ActivityIndicator color={LightTheme.accent} style={{ marginTop: Spacing.md }} />
  if (!sheets.length) return <Text style={styles.emptyText}>Geen schema's gevonden.</Text>

  return (
    <View style={styles.browser}>
      {sheets.map(s => (
        <TouchableOpacity key={s.id} style={styles.sheetRow} onPress={() => onSelect(s)}>
          <Text style={styles.sheetName} numberOfLines={1}>{s.name}</Text>
          <Text style={styles.sheetChevron}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ── URL linker ─────────────────────────────────────────────────────────────

function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : (url.length > 10 ? url.trim() : null)
}

function UrlLinker({ onLink }: { onLink: (entry: SchemaEntry) => void }) {
  const [url, setUrl] = useState('')

  function handleLink() {
    const id = extractSheetId(url)
    if (!id) { return }
    onLink({ id, name: 'Google Sheet', url, ts: Date.now() })
  }

  return (
    <View style={styles.urlLinker}>
      <TextInput
        style={styles.urlInput}
        value={url}
        onChangeText={setUrl}
        placeholder="Plak hier de Google Sheets URL"
        placeholderTextColor={LightTheme.faint}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity style={styles.urlBtn} onPress={handleLink}>
        <Text style={styles.urlBtnText}>Koppelen</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── Main ConnectSection ────────────────────────────────────────────────────

type Panel = 'history' | 'new' | 'url' | null

export function ConnectSection() {
  const theme         = useTheme()
  const navigation    = useNavigation<any>()
  const getToken      = useAuthStore(s => s.getToken)
  const tokenSet      = useAuthStore(s => s.tokenSet)
  const sheetId       = useDataStore(s => s.sheetId)
  const sheetFileName = useDataStore(s => s.sheetFileName)
  const tabName       = useDataStore(s => s.tabName)
  const schemaId      = useDataStore(s => s.schemaId)
  const schemaName    = useDataStore(s => s.schemaName)
  const activities    = useDataStore(s => s.activities)
  const setSchema     = useDataStore(s => s.setSchema)
  const clearSchema   = useDataStore(s => s.clearSchema)
  const showToast     = useUiStore(s => s.showToast)

  const [panel,       setPanel]       = useState<Panel>(null)
  const [creating,    setCreating]    = useState(false)
  const [importOpen,  setImportOpen]  = useState(false)
  const [syncing,     setSyncing]     = useState(false)

  async function handleSync() {
    if (!sheetId) return
    setSyncing(true)
    try {
      const token = await getToken()
      if (!token) { showToast('Niet ingelogd'); return }
      const { synced } = await syncActivitiesToSheet(sheetId, tabName, token, activities)
      showToast(`✓ ${synced} activiteiten gesynchroniseerd`)
    } catch {
      showToast('Synchronisatie mislukt')
    } finally {
      setSyncing(false)
    }
  }

  const isSignedIn         = !!tokenSet
  const isConnectedSheet   = isSignedIn && !!sheetId
  const isConnectedBackend = isSignedIn && !!schemaId && !sheetId

  function togglePanel(p: Panel) {
    setPanel(prev => prev === p ? null : p)
  }

  async function linkSheet(entry: SchemaEntry) {
    const token = await getToken()
    if (!token) return
    showToast('Schema koppelen…')
    try {
      const tabId = await getSheetTabId(entry.id, 'Schema', token).catch(() => 0)
      await verifyOrFixHeaders(entry.id, 'Schema', token).catch(() => {})
      await setSchema(entry.id, 'Schema', entry.name, tabId)
      setPanel(null)
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
      const name  = todaySchemaName()
      const entry = await createNewSheet(token, name)
      await verifyOrFixHeaders(entry.id, 'Schema', token)
      const tabId = await getSheetTabId(entry.id, 'Schema', token).catch(() => 0)
      await setSchema(entry.id, 'Schema', entry.name, tabId)
      setPanel(null)
      showToast(`✓ ${entry.name} aangemaakt`)
    } catch {
      showToast('Aanmaken mislukt')
    } finally {
      setCreating(false)
    }
  }

  // ── The 3 new-schema tiles ────────────────────────────────────────────────

  const newSchemaPanel = (
    <View style={styles.panelContent}>
      <ConnectTile
        primary
        icon="✦"
        title="Importeer eigen schema"
        badge="Aanbevolen"
        sub="PDF, Excel, foto of van je coach — gratis proberen"
        onPress={() => setImportOpen(true)}
      />
      <ConnectTile
        icon="🔗"
        title="Koppel Google Sheets"
        sub="Plak een Google Sheets URL"
        onPress={() => togglePanel(panel === 'url' ? null : 'url')}
      />
      {panel === 'url' && <UrlLinker onLink={linkSheet} />}
      <ConnectTile
        icon="＋"
        title="Leeg schema aanmaken"
        sub={`Nieuw leeg schema met datum als naam`}
        onPress={creating ? () => {} : handleCreateNew}
      />
      {creating && <ActivityIndicator color={LightTheme.accent} />}
    </View>
  )

  // ── Signed in (connected or not) — same layout ──────────────────────────

  if (isSignedIn) {
    return (
      <View style={styles.container}>
        {/* Connected schema display — Sheets */}
        {isConnectedSheet && (
          <>
            <View style={styles.connectedRow}>
              <View style={styles.greenDot} />
              <View style={styles.connectedInfo}>
                <Text style={styles.fileName}>{sheetFileName ?? 'Schema'}</Text>
              </View>
              <TouchableOpacity onPress={() => clearSchema()}>
                <Text style={styles.disconnectText}>Ontkoppelen</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.exportBtn} onPress={handleSync} disabled={syncing}>
              <Text style={styles.exportBtnText}>{syncing ? 'Bezig…' : '→ Sheets'}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Connected schema display — backend import */}
        {isConnectedBackend && (
          <View style={styles.connectedRow}>
            <View style={styles.greenDot} />
            <View style={styles.connectedInfo}>
              <Text style={styles.fileName}>{schemaName ?? 'Geïmporteerd schema'}</Text>
            </View>
          </View>
        )}

        {/* Always-visible buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btnSave, panel === 'history' && styles.btnSaveActive]}
            onPress={() => togglePanel('history')}
          >
            <Text style={styles.btnSaveText}>Gekoppelde schema's</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSave, panel === 'new' && styles.btnSaveActive]}
            onPress={() => togglePanel('new')}
          >
            <Text style={styles.btnSaveText}>+ Nieuw trainingsschema</Text>
          </TouchableOpacity>
        </View>

        {/* Gekoppelde schema's panel */}
        {panel === 'history' && <SchemaBrowser onSelect={linkSheet} />}

        {/* Nieuw trainingsschema — always the 3 tiles */}
        {panel === 'new' && newSchemaPanel}

        <ImportModal
          visible={importOpen}
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            setImportOpen(false)
            navigation.navigate('Main')
          }}
        />
      </View>
    )
  }

  // ── Not signed in ─────────────────────────────────────────────────────────

  return (
    <Text style={styles.notSignedIn}>Log eerst in om een schema te koppelen.</Text>
  )
}

const styles = StyleSheet.create({
  container:          { gap: Spacing.md },

  // Connect tile
  tile:               { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: LightTheme.surface, borderWidth: 1, borderColor: LightTheme.border, borderRadius: Radius.lg, padding: 16 },
  tilePrimary:        { backgroundColor: LightTheme.text, borderColor: LightTheme.text },
  tileIcon:           { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: LightTheme.bg },
  tileIconPrimary:    { backgroundColor: LightTheme.accent },
  tileIconText:       { fontSize: 20 },
  tileBody:           { flex: 1, minWidth: 0 },
  tileTitleRow:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  tileTitle:          { fontFamily: Fonts.displaySemiBold, fontSize: 15, color: LightTheme.text, letterSpacing: -0.1 },
  tileTitlePrimary:   { color: '#fff' },
  badge:              { backgroundColor: LightTheme.accent, borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText:          { fontFamily: Fonts.displayBold, fontSize: 9, color: LightTheme.accentInk, letterSpacing: -0.1 },
  tileSub:            { fontFamily: Fonts.display, fontSize: 12, color: LightTheme.muted, marginTop: 2 },
  tileSubPrimary:     { color: 'rgba(255,255,255,0.65)' },
  tileChevron:        { fontFamily: Fonts.display, fontSize: 20, color: LightTheme.faint },
  tileChevronPrimary: { color: 'rgba(255,255,255,0.5)' },

  // Connected state
  connectedRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  greenDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: LightTheme.accent, flexShrink: 0 },
  connectedInfo:  { flex: 1 },
  fileName:       { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: LightTheme.text },
  tabLabel:       { fontFamily: Fonts.mono, fontSize: 11, color: LightTheme.muted, marginTop: 2 },
  disconnectText: { fontFamily: Fonts.displayMedium, fontSize: 12, color: LightTheme.muted, textDecorationLine: 'underline' },
  exportBtn:      { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.sm, backgroundColor: LightTheme.bgAlt, borderWidth: 1, borderColor: LightTheme.border, alignSelf: 'flex-start' },
  exportBtnText:  { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.text },

  // Buttons
  btnRow:         { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  btnSave:        { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.sm, backgroundColor: LightTheme.bgAlt, borderWidth: 1, borderColor: LightTheme.border },
  btnSaveActive:  { borderColor: LightTheme.accent },
  btnSaveText:    { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.text },

  // Panel
  panelContent:   { gap: Spacing.sm },

  // Schema browser
  browser:        { borderRadius: Radius.md, overflow: 'hidden', borderWidth: 1, borderColor: LightTheme.border },
  sheetRow:       { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: LightTheme.border, backgroundColor: LightTheme.surface },
  sheetName:      { flex: 1, fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text },
  sheetChevron:   { fontFamily: Fonts.display, fontSize: 18, color: LightTheme.faint },
  emptyText:      { fontFamily: Fonts.mono, fontSize: 12, color: LightTheme.muted },

  // URL linker
  urlLinker:      { gap: Spacing.sm },
  urlInput:       { fontFamily: Fonts.display, fontSize: 13, color: LightTheme.text, backgroundColor: LightTheme.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: LightTheme.border },
  urlBtn:         { backgroundColor: LightTheme.accent, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  urlBtnText:     { fontFamily: Fonts.displaySemiBold, fontSize: 14, color: '#fff' },

  // Hints
  signedInHint:   { fontFamily: Fonts.display, fontSize: 12, color: LightTheme.muted },
  signedInEmail:  { fontFamily: Fonts.displaySemiBold, color: LightTheme.text },
  notSignedIn:    { fontFamily: Fonts.display, fontSize: 13, color: LightTheme.muted },
})
