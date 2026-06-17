import { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Svg, { Rect, Line, Path } from 'react-native-svg'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { syncActivitiesToSheet } from '@/services/sheets'
import { createExportSheet } from '@/services/drive'
import { createSchema, renameSchema } from '@/services/schemas'
import type { SchemaMeta } from '@/stores/dataStore'
import { ImportWizard } from '@/screens/import/ImportWizard'
import { ActionMenu, type ActionMenuItem } from '@/components/shared/ActionMenu'
import { Fonts } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { SectionLabel, Card, Divider, ActionRow } from './ui'

// ── kleine glyphs ──────────────────────────────────────────
function DocGlyph({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={4} y={3} width={16} height={18} rx={2.5} />
      <Line x1={8} y1={8} x2={16} y2={8} />
      <Line x1={8} y1={12} x2={16} y2={12} />
      <Line x1={8} y1={16} x2={13} y2={16} />
    </Svg>
  )
}

function Chevron({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  )
}

// ── Mijn schema's rij ──────────────────────────────────────
function SchemaRow({ s, last, renaming, renameValue, onRenameChange, onRenameCommit, onRenameCancel, onOpenMenu }: {
  s: SchemaMeta
  last: boolean
  renaming: boolean
  renameValue: string
  onRenameChange: (v: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onOpenMenu: () => void
}) {
  const theme = useTheme()
  return (
    <View style={[styles.schemaRow, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      {/* Stip = weergegeven (kan meerdere); outline = niet weergegeven */}
      <View style={[styles.dot, { borderColor: s.isVisible ? theme.accent : theme.faint }]}>
        {s.isVisible && <View style={[styles.dotFill, { backgroundColor: theme.accent }]} />}
      </View>

      <View style={styles.schemaBody}>
        {renaming ? (
          <TextInput
            style={[styles.renameInput, { color: theme.text, borderColor: theme.accent, backgroundColor: theme.bg }]}
            value={renameValue}
            onChangeText={onRenameChange}
            onSubmitEditing={onRenameCommit}
            placeholder="Schemanaam"
            placeholderTextColor={theme.faint}
            autoFocus
          />
        ) : (
          <>
            <Text style={[styles.schemaName, { color: theme.text }, s.isArchived && { color: theme.muted }]} numberOfLines={1}>
              {s.name}{s.isArchived ? ' · gearchiveerd' : ''}
            </Text>
          </>
        )}
      </View>

      {renaming ? (
        <View style={styles.renameActions}>
          <TouchableOpacity onPress={onRenameCancel} hitSlop={8}>
            <Text style={[styles.renameBtn, { color: theme.muted }]}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRenameCommit} hitSlop={8}>
            <Text style={[styles.renameBtn, { color: theme.accent }]}>✓</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={onOpenMenu} hitSlop={8} style={styles.menuBtn}>
          <Text style={[styles.menuDots, { color: theme.muted }]}>···</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ── Main ───────────────────────────────────────────────────
export function ConnectSection() {
  const theme             = useTheme()
  const navigation        = useNavigation<any>()
  const getToken          = useAuthStore(s => s.getToken)
  const tokenSet          = useAuthStore(s => s.tokenSet)
  const schemaName        = useDataStore(s => s.schemaName)
  const visibleSchemaIds  = useDataStore(s => s.visibleSchemaIds)
  const schemaList        = useDataStore(s => s.schemaList)
  const activities        = useDataStore(s => s.activities)
  const loadMySchemas     = useDataStore(s => s.loadMySchemas)
  const setSchemaVisible  = useDataStore(s => s.setSchemaVisible)
  const archiveSchemaById = useDataStore(s => s.archiveSchemaById)
  const activateImport    = useDataStore(s => s.activateImport)
  const showToast         = useUiStore(s => s.showToast)

  const [open,           setOpen]           = useState(false)
  const [importOpen,     setImportOpen]     = useState(false)
  const [creating,       setCreating]       = useState(false)
  const [exporting,      setExporting]      = useState(false)
  const [schemasLoading, setSchemasLoading] = useState(false)
  const [renamingId,     setRenamingId]     = useState<string | null>(null)
  const [renameValue,    setRenameValue]    = useState('')
  const [menuSchemaId,   setMenuSchemaId]   = useState<string | null>(null)

  const menuSchema = schemaList.find(s => s.id === menuSchemaId) ?? null

  async function handleExportToSheets(schema: SchemaMeta) {
    if (tokenSet?.authMethod !== 'google') {
      showToast('Exporteren naar Sheets vereist inloggen met Google')
      return
    }
    setExporting(true)
    try {
      const token = await getToken()
      if (!token) { showToast('Niet ingelogd'); return }
      const { id, url } = await createExportSheet(token, schema.name)
      const schemaActivities = activities.filter(a => a.schemaId === schema.id)
      const { synced } = await syncActivitiesToSheet(id, 'Schema', token, schemaActivities)
      showToast(`✓ ${synced} activiteiten geëxporteerd`)
      await Linking.openURL(url)
    } catch {
      showToast('Exporteren mislukt')
    } finally {
      setExporting(false)
    }
  }

  async function toggleDropdown() {
    const next = !open
    setOpen(next)
    if (next && !schemasLoading) {
      setSchemasLoading(true)
      try { await loadMySchemas() } finally { setSchemasLoading(false) }
    }
  }

  async function handleCreateNew() {
    setCreating(true)
    try {
      const { id } = await createSchema('Leeg schema')
      await activateImport(id, 'Leeg schema')
      showToast('✓ Leeg schema aangemaakt')
    } catch {
      showToast('Aanmaken mislukt')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleVisible(schema: SchemaMeta) {
    try {
      await setSchemaVisible(schema.id, !schema.isVisible)
      showToast(schema.isVisible ? `${schema.name} verborgen` : `✓ ${schema.name} weergegeven`)
    } catch {
      showToast('Wijzigen mislukt')
    }
  }

  async function handleArchive(schema: SchemaMeta) {
    try { await archiveSchemaById(schema.id, true); showToast(`${schema.name} gearchiveerd`) }
    catch { showToast('Archiveren mislukt') }
  }

  async function handleUnarchive(schema: SchemaMeta) {
    try { await archiveSchemaById(schema.id, false); showToast(`${schema.name} teruggezet`) }
    catch { showToast('Terugzetten mislukt') }
  }

  function handleRenameStart(schema: SchemaMeta) {
    setRenamingId(schema.id)
    setRenameValue(schema.name)
  }

  async function handleRenameCommit(schema: SchemaMeta) {
    if (!renameValue.trim() || renameValue.trim() === schema.name) { setRenamingId(null); return }
    const newName = renameValue.trim()
    setRenamingId(null)
    try {
      await renameSchema(schema.id, newName)
      await loadMySchemas()
    } catch {
      showToast('Hernoemen mislukt')
    }
  }

  function menuItemsFor(schema: SchemaMeta): ActionMenuItem[] {
    if (schema.isArchived) {
      return [
        { label: 'Terugzetten', icon: '↩', onPress: () => handleUnarchive(schema) },
        { label: 'Hernoemen', icon: '✏', onPress: () => handleRenameStart(schema) },
        { label: 'Exporteren', icon: '↗', onPress: () => handleExportToSheets(schema), disabled: exporting },
      ]
    }
    return [
      { label: 'Weergeven', checked: schema.isVisible, onPress: () => handleToggleVisible(schema) },
      { label: 'Hernoemen', icon: '✏', onPress: () => handleRenameStart(schema) },
      { label: 'Exporteren', icon: '↗', onPress: () => handleExportToSheets(schema), disabled: exporting },
      { label: 'Archiveren', icon: '📦', onPress: () => handleArchive(schema), destructive: true },
    ]
  }

  if (!tokenSet) {
    return (
      <View>
        <SectionLabel>Schema</SectionLabel>
        <Card style={{ padding: 14 }}>
          <Text style={[styles.notSignedIn, { color: theme.muted }]}>Log eerst in om een schema te koppelen.</Text>
        </Card>
      </View>
    )
  }

  const extra = visibleSchemaIds.length > 1 ? ` +${visibleSchemaIds.length - 1}` : ''
  const summary = visibleSchemaIds.length > 0 ? `Weergegeven: ${schemaName ?? 'Schema'}${extra}` : 'Niets weergegeven'

  return (
    <View>
      <SectionLabel>Schema</SectionLabel>

      {/* Mijn schema's dropdown */}
      <Card>
        <TouchableOpacity style={styles.trigger} onPress={toggleDropdown} activeOpacity={0.7}>
          <View style={[styles.triggerIcon, { backgroundColor: theme.surface2 }]}>
            <DocGlyph color={theme.text} />
          </View>
          <View style={styles.triggerBody}>
            <View style={styles.triggerTitleRow}>
              <Text style={[styles.triggerTitle, { color: theme.text }]}>Mijn schema's</Text>
              <View style={[styles.countBadge, { backgroundColor: theme.accent }]}>
                <Text style={[styles.countText, { color: theme.accentInk }]}>{schemaList.length}</Text>
              </View>
            </View>
            <Text style={[styles.triggerSub, { color: theme.muted }]} numberOfLines={1}>{summary}</Text>
          </View>
          <Chevron open={open} color={theme.muted} />
        </TouchableOpacity>

        {open && (
          <>
            <Divider />
            {schemasLoading ? (
              <View style={{ padding: 16 }}><ActivityIndicator color={theme.accent} /></View>
            ) : schemaList.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.muted }]}>Geen schema's gevonden.</Text>
            ) : (
              schemaList.map((sc, i) => (
                <SchemaRow
                  key={sc.id}
                  s={sc}
                  last={i === schemaList.length - 1}
                  renaming={renamingId === sc.id}
                  renameValue={renameValue}
                  onRenameChange={setRenameValue}
                  onRenameCommit={() => handleRenameCommit(sc)}
                  onRenameCancel={() => setRenamingId(null)}
                  onOpenMenu={() => setMenuSchemaId(sc.id)}
                />
              ))
            )}
          </>
        )}
      </Card>

      <View style={{ height: 10 }} />

      {/* Import + leeg schema */}
      <Card>
        <ActionRow
          icon="✦"
          iconBg={theme.text}
          iconColor={theme.accent}
          title="Importeer eigen schema"
          badge="Aanbevolen"
          sub="PDF, Excel, foto of link"
          chevron={false}
          onPress={() => setImportOpen(true)}
        />
        <Divider />
        <ActionRow
          icon="+"
          title="Leeg schema aanmaken"
          sub="Start met een leeg schema"
          chevron={false}
          onPress={creating ? undefined : handleCreateNew}
        />
      </Card>
      {creating && <ActivityIndicator color={theme.accent} style={{ marginTop: 8 }} />}

      {/* Actie-menu per schema */}
      <ActionMenu
        visible={menuSchema !== null}
        title={menuSchema?.name}
        items={menuSchema ? menuItemsFor(menuSchema) : []}
        onClose={() => setMenuSchemaId(null)}
      />

      <ImportWizard
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

const styles = StyleSheet.create({
  // dropdown trigger
  trigger:        { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 },
  triggerIcon:    { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  triggerBody:    { flex: 1, minWidth: 0 },
  triggerTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  triggerTitle:   { fontFamily: Fonts.displayBold, fontSize: 14.5, letterSpacing: -0.1 },
  triggerSub:     { fontFamily: Fonts.display, fontSize: 12.5, marginTop: 2 },
  countBadge:     { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  countText:      { fontFamily: Fonts.monoMedium, fontSize: 10 },

  // schema rij
  schemaRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  dot:            { width: 16, height: 16, borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dotFill:        { width: 8, height: 8, borderRadius: 999 },
  schemaBody:     { flex: 1, minWidth: 0 },
  schemaName:     { fontFamily: Fonts.displaySemiBold, fontSize: 14.5, letterSpacing: -0.1 },
  renameInput:    { fontFamily: Fonts.displaySemiBold, fontSize: 14, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderRadius: 8 },
  menuBtn:        { paddingHorizontal: 4, paddingVertical: 2 },
  menuDots:       { fontFamily: Fonts.display, fontSize: 18 },
  renameActions:  { flexDirection: 'row', gap: 12, marginLeft: 8 },
  renameBtn:      { fontFamily: Fonts.displaySemiBold, fontSize: 16 },

  emptyText:      { fontFamily: Fonts.mono, fontSize: 12, padding: 14 },
  notSignedIn:    { fontFamily: Fonts.display, fontSize: 13 },
})
