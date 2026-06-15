import { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { syncActivitiesToSheet } from '@/services/sheets'
import { createExportSheet } from '@/services/drive'
import { createSchema, renameSchema } from '@/services/schemas'
import type { SchemaMeta } from '@/stores/dataStore'
import { ImportWizard } from '@/screens/import/ImportWizard'
import { ImportSchemaTile } from '@/components/shared/ImportSchemaTile'
import { ActionMenu, type ActionMenuItem } from '@/components/shared/ActionMenu'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

// ── Connect tile ───────────────────────────────────────────────────────────

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

// ── Mijn schema's panel ────────────────────────────────────────────────────

type MySchemasListProps = {
  schemas: SchemaMeta[]
  renamingId: string | null
  renameValue: string
  onRenameChange: (value: string) => void
  onRenameCommit: (schema: SchemaMeta) => void
  onRenameCancel: () => void
  onOpenMenu: (schema: SchemaMeta) => void
}

function MySchemasList({
  schemas,
  renamingId,
  renameValue,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onOpenMenu,
}: MySchemasListProps) {
  if (!schemas.length) {
    return <Text style={styles.emptyText}>Geen schema's gevonden.</Text>
  }

  return (
    <View style={styles.schemaList}>
      {schemas.map(schema => {
        const isRenaming = renamingId === schema.id

        return (
          <View key={schema.id} style={styles.schemaRow}>
            <View style={styles.schemaRowMain}>
              {/* Groene stip = weergegeven (kan meerdere); gedimd = niet weergegeven */}
              <View style={[styles.schemaDot, schema.isVisible && styles.schemaDotActive]} />
              {isRenaming ? (
                <TextInput
                  style={styles.renameInput}
                  value={renameValue}
                  onChangeText={onRenameChange}
                  onSubmitEditing={() => onRenameCommit(schema)}
                  placeholder="Schemanaam"
                  placeholderTextColor={LightTheme.faint}
                  autoFocus
                />
              ) : (
                <Text
                  style={[styles.schemaName, schema.isArchived && styles.schemaNameArchived]}
                  numberOfLines={1}
                >
                  {schema.name}{schema.isArchived ? ' · gearchiveerd' : ''}
                </Text>
              )}
            </View>

            {isRenaming ? (
              <View style={styles.renameActions}>
                <TouchableOpacity onPress={onRenameCancel} hitSlop={8}>
                  <Text style={styles.renameBtn}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onRenameCommit(schema)} hitSlop={8}>
                  <Text style={[styles.renameBtn, styles.renameBtnOk]}>✓</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => onOpenMenu(schema)} hitSlop={8} style={styles.menuBtn}>
                <Text style={styles.schemaActionIcon}>⋯</Text>
              </TouchableOpacity>
            )}
          </View>
        )
      })}
    </View>
  )
}

// ── Main ConnectSection ────────────────────────────────────────────────────

type Panel = 'schemas' | null

export function ConnectSection() {
  const theme            = useTheme()
  const navigation       = useNavigation<any>()
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

  const [panel,           setPanel]          = useState<Panel>(null)
  const [importOpen,      setImportOpen]      = useState(false)
  const [creating,        setCreating]        = useState(false)
  const [exporting,       setExporting]       = useState(false)

  // Mijn schema's state
  const [schemasLoading,  setSchemasLoading]  = useState(false)
  const [renamingId,      setRenamingId]      = useState<string | null>(null)
  const [renameValue,     setRenameValue]     = useState('')
  const [menuSchemaId,    setMenuSchemaId]    = useState<string | null>(null)

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
      // Exporteer alléén de activiteiten van dít schema (niet de samengevoegde lijst).
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

  function togglePanel(p: Panel) {
    setPanel(prev => prev === p ? null : p)
  }

  async function loadSchemas() {
    if (schemasLoading) return
    setSchemasLoading(true)
    try {
      await loadMySchemas()
    } finally {
      setSchemasLoading(false)
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
    try {
      await archiveSchemaById(schema.id, true)
      showToast(`${schema.name} gearchiveerd`)
    } catch {
      showToast('Archiveren mislukt')
    }
  }

  async function handleUnarchive(schema: SchemaMeta) {
    try {
      await archiveSchemaById(schema.id, false)
      showToast(`${schema.name} teruggezet`)
    } catch {
      showToast('Terugzetten mislukt')
    }
  }

  function handleRenameStart(schema: SchemaMeta) {
    setRenamingId(schema.id)
    setRenameValue(schema.name)
  }

  async function handleRenameCommit(schema: SchemaMeta) {
    if (!renameValue.trim() || renameValue.trim() === schema.name) {
      setRenamingId(null)
      return
    }
    const newName = renameValue.trim()
    setRenamingId(null)
    try {
      await renameSchema(schema.id, newName)
      await loadMySchemas()
    } catch {
      showToast('Hernoemen mislukt')
    }
  }

  // Bouwt de menu-items voor één schema (verschilt voor gearchiveerd).
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

  const isSignedIn         = !!tokenSet
  const isConnectedBackend = isSignedIn && visibleSchemaIds.length > 0

  if (isSignedIn) {
    return (
      <View style={styles.container}>
        {/* Connected schema display — backend */}
        {isConnectedBackend && (
          <View style={styles.connectedRow}>
            <View style={styles.greenDot} />
            <View style={styles.connectedInfo}>
              <Text style={styles.fileName}>
                {schemaName ?? 'Schema'}
                {visibleSchemaIds.length > 1 ? ` +${visibleSchemaIds.length - 1}` : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Mijn schema's chip-knop */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btnSave, panel === 'schemas' && styles.btnSaveActive]}
            onPress={() => { togglePanel('schemas'); if (panel !== 'schemas') loadSchemas() }}
          >
            <Text style={styles.btnSaveText}>Mijn schema's</Text>
          </TouchableOpacity>
        </View>

        {/* Mijn schema's panel */}
        {panel === 'schemas' && (
          schemasLoading
            ? <ActivityIndicator color={LightTheme.accent} />
            : (
              <MySchemasList
                schemas={schemaList}
                renamingId={renamingId}
                renameValue={renameValue}
                onRenameChange={setRenameValue}
                onRenameCommit={handleRenameCommit}
                onRenameCancel={() => setRenamingId(null)}
                onOpenMenu={(schema) => setMenuSchemaId(schema.id)}
              />
            )
        )}

        {/* Actie-menu per schema */}
        <ActionMenu
          visible={menuSchema !== null}
          title={menuSchema?.name}
          items={menuSchema ? menuItemsFor(menuSchema) : []}
          onClose={() => setMenuSchemaId(null)}
        />

        {/* Tiles — altijd zichtbaar */}
        <ImportSchemaTile recommended onPress={() => setImportOpen(true)} />
        <ConnectTile
          icon="＋"
          title="Leeg schema aanmaken"
          sub="Start met een leeg schema"
          onPress={creating ? () => {} : handleCreateNew}
        />
        {creating && <ActivityIndicator color={LightTheme.accent} />}

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

  // Buttons
  btnRow:         { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  btnSave:        { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.sm, backgroundColor: LightTheme.bgAlt, borderWidth: 1, borderColor: LightTheme.border },
  btnSaveActive:  { borderColor: LightTheme.accent },
  btnSaveText:    { fontFamily: Fonts.displayMedium, fontSize: 13, color: LightTheme.text },

  // Schema list
  schemaList:         { borderRadius: Radius.md, overflow: 'hidden', borderWidth: 1, borderColor: LightTheme.border },
  schemaRow:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: LightTheme.border, backgroundColor: LightTheme.surface },
  schemaRowMain:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minWidth: 0 },
  schemaDot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: LightTheme.border, flexShrink: 0 },
  schemaDotActive:    { backgroundColor: LightTheme.accent },
  schemaName:         { flex: 1, fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text },
  schemaNameArchived: { color: LightTheme.muted },
  renameInput:        { flex: 1, fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderWidth: 1, borderColor: LightTheme.accent, borderRadius: Radius.sm, backgroundColor: LightTheme.bg },
  menuBtn:            { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, marginLeft: Spacing.sm },
  schemaActionIcon:   { fontSize: 18, color: LightTheme.muted },
  renameActions:      { flexDirection: 'row', gap: Spacing.sm, marginLeft: Spacing.sm },
  renameBtn:          { fontFamily: Fonts.displaySemiBold, fontSize: 16, color: LightTheme.muted },
  renameBtnOk:        { color: LightTheme.accent },

  // Misc
  emptyText:      { fontFamily: Fonts.mono, fontSize: 12, color: LightTheme.muted },
  notSignedIn:    { fontFamily: Fonts.display, fontSize: 13, color: LightTheme.muted },
})
