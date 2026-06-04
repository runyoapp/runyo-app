import { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { syncActivitiesToSheet } from '@/services/sheets'
import { createExportSheet } from '@/services/drive'
import { createSchema, getMySchemas, renameSchema, deleteSchema } from '@/services/schemas'
import type { Schema } from '@/services/schemas'
import { ImportModal } from '@/screens/ImportModal'
import { ImportSchemaTile } from '@/components/shared/ImportSchemaTile'
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
  schemas: Schema[]
  activeId: string | null
  renamingId: string | null
  renameValue: string
  deleteConfirmId: string | null
  exporting: boolean
  onActivate: (schema: Schema) => void
  onRenameStart: (schema: Schema) => void
  onRenameChange: (value: string) => void
  onRenameCommit: (schema: Schema) => void
  onDeleteRequest: (id: string) => void
  onDeleteCancel: () => void
  onDeleteConfirm: (id: string) => void
  onExport: (schema: Schema) => void
}

function MySchemasList({
  schemas,
  activeId,
  renamingId,
  renameValue,
  deleteConfirmId,
  exporting,
  onActivate,
  onRenameStart,
  onRenameChange,
  onRenameCommit,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
  onExport,
}: MySchemasListProps) {
  if (!schemas.length) {
    return <Text style={styles.emptyText}>Geen schema's gevonden.</Text>
  }

  return (
    <View style={styles.schemaList}>
      {schemas.map(schema => {
        const isActive = schema.id === activeId
        const isRenaming = renamingId === schema.id
        const isDeleting = deleteConfirmId === schema.id

        return (
          <View key={schema.id} style={styles.schemaRow}>
            <TouchableOpacity
              style={styles.schemaRowMain}
              onPress={() => !isRenaming && !isDeleting && onActivate(schema)}
              activeOpacity={0.7}
            >
              <View style={[styles.schemaDot, isActive && styles.schemaDotActive]} />
              {isRenaming ? (
                <TextInput
                  style={styles.renameInput}
                  value={renameValue}
                  onChangeText={onRenameChange}
                  onBlur={() => onRenameCommit(schema)}
                  onSubmitEditing={() => onRenameCommit(schema)}
                  autoFocus
                />
              ) : (
                <Text style={styles.schemaName} numberOfLines={1}>{schema.name}</Text>
              )}
            </TouchableOpacity>

            {isDeleting ? (
              <View style={styles.deleteConfirm}>
                <Text style={styles.deleteConfirmText}>Verwijderen?</Text>
                <TouchableOpacity onPress={onDeleteCancel}>
                  <Text style={styles.deleteConfirmBtn}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDeleteConfirm(schema.id)}>
                  <Text style={[styles.deleteConfirmBtn, styles.deleteConfirmYes]}>✓</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.schemaActions}>
                <TouchableOpacity onPress={() => onRenameStart(schema)} hitSlop={8}>
                  <Text style={styles.schemaActionIcon}>✏</Text>
                </TouchableOpacity>
                {isActive && (
                  <TouchableOpacity onPress={() => !exporting && onExport(schema)} hitSlop={8}>
                    <Text style={styles.schemaActionIcon}>{exporting ? '…' : '↗'}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => onDeleteRequest(schema.id)} hitSlop={8}>
                  <Text style={[styles.schemaActionIcon, styles.schemaActionDelete]}>🗑</Text>
                </TouchableOpacity>
              </View>
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
  const getToken         = useAuthStore(s => s.getToken)
  const tokenSet         = useAuthStore(s => s.tokenSet)
  const schemaId         = useDataStore(s => s.schemaId)
  const schemaName       = useDataStore(s => s.schemaName)
  const activities       = useDataStore(s => s.activities)
  const activateImport   = useDataStore(s => s.activateImport)
  const activateSchemaById = useDataStore(s => s.activateSchemaById)
  const showToast        = useUiStore(s => s.showToast)

  const [panel,           setPanel]          = useState<Panel>(null)
  const [importOpen,      setImportOpen]      = useState(false)
  const [creating,        setCreating]        = useState(false)
  const [exporting,       setExporting]       = useState(false)

  // Mijn schema's state
  const [schemas,         setSchemas]         = useState<Schema[]>([])
  const [schemasLoading,  setSchemasLoading]  = useState(false)
  const [renamingId,      setRenamingId]      = useState<string | null>(null)
  const [renameValue,     setRenameValue]     = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  async function handleExportToSheets(schema: Schema) {
    if (tokenSet?.authMethod !== 'google') {
      showToast('Exporteren naar Sheets vereist inloggen met Google')
      return
    }
    setExporting(true)
    try {
      const token = await getToken()
      if (!token) { showToast('Niet ingelogd'); return }
      const { id, url } = await createExportSheet(token, schema.name)
      const { synced } = await syncActivitiesToSheet(id, 'Schema', token, activities)
      showToast(`✓ ${synced} activiteiten geëxporteerd`)
      await Linking.openURL(url)
    } catch {
      showToast('Exporteren mislukt')
    } finally {
      setExporting(false)
    }
  }

  async function loadSchemas() {
    if (schemasLoading) return
    setSchemasLoading(true)
    try {
      setSchemas(await getMySchemas())
    } finally {
      setSchemasLoading(false)
    }
  }

  function togglePanel(p: Panel) {
    setPanel(prev => prev === p ? null : p)
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

  async function handleActivate(schema: Schema) {
    if (schema.id === schemaId) return
    try {
      await activateSchemaById(schema.id, schema.name)
      showToast(`✓ ${schema.name} actief`)
    } catch {
      showToast('Wisselen mislukt')
    }
  }

  function handleRenameStart(schema: Schema) {
    setDeleteConfirmId(null)
    setRenamingId(schema.id)
    setRenameValue(schema.name)
  }

  async function handleRenameCommit(schema: Schema) {
    if (!renameValue.trim() || renameValue.trim() === schema.name) {
      setRenamingId(null)
      return
    }
    const newName = renameValue.trim()
    setRenamingId(null)
    try {
      await renameSchema(schema.id, newName)
      setSchemas(prev => prev.map(s => s.id === schema.id ? { ...s, name: newName } : s))
      if (schema.id === schemaId) await activateImport(schema.id, newName)
    } catch {
      showToast('Hernoemen mislukt')
    }
  }

  async function handleDeleteConfirm(id: string) {
    setDeleteConfirmId(null)
    try {
      await deleteSchema(id)
      setSchemas(prev => prev.filter(s => s.id !== id))
      if (id === schemaId) {
        await activateImport('', '')
        showToast('Schema verwijderd')
      } else {
        showToast('Schema verwijderd')
      }
    } catch {
      showToast('Verwijderen mislukt')
    }
  }

  const isSignedIn         = !!tokenSet
  const isConnectedBackend = isSignedIn && !!schemaId

  if (isSignedIn) {
    return (
      <View style={styles.container}>
        {/* Connected schema display — backend */}
        {isConnectedBackend && (
          <View style={styles.connectedRow}>
            <View style={styles.greenDot} />
            <View style={styles.connectedInfo}>
              <Text style={styles.fileName}>{schemaName ?? 'Schema'}</Text>
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
                schemas={schemas}
                activeId={schemaId}
                renamingId={renamingId}
                renameValue={renameValue}
                deleteConfirmId={deleteConfirmId}
                exporting={exporting}
                onActivate={handleActivate}
                onRenameStart={handleRenameStart}
                onRenameChange={setRenameValue}
                onRenameCommit={handleRenameCommit}
                onDeleteRequest={(id) => { setRenamingId(null); setDeleteConfirmId(id) }}
                onDeleteCancel={() => setDeleteConfirmId(null)}
                onDeleteConfirm={handleDeleteConfirm}
                onExport={handleExportToSheets}
              />
            )
        )}

        {/* Tiles — altijd zichtbaar */}
        <ImportSchemaTile recommended onPress={() => setImportOpen(true)} />
        <ConnectTile
          icon="＋"
          title="Leeg schema aanmaken"
          sub="Start met een leeg schema"
          onPress={creating ? () => {} : handleCreateNew}
        />
        {creating && <ActivityIndicator color={LightTheme.accent} />}

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
  renameInput:        { flex: 1, fontFamily: Fonts.displayMedium, fontSize: 14, color: LightTheme.text, padding: 0 },
  schemaActions:      { flexDirection: 'row', gap: Spacing.sm, marginLeft: Spacing.sm },
  schemaActionIcon:   { fontSize: 16, color: LightTheme.muted },
  schemaActionDelete: { color: LightTheme.muted },

  // Delete confirm
  deleteConfirm:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginLeft: Spacing.sm },
  deleteConfirmText: { fontFamily: Fonts.display, fontSize: 12, color: LightTheme.muted },
  deleteConfirmBtn:  { fontFamily: Fonts.displaySemiBold, fontSize: 15, color: LightTheme.muted },
  deleteConfirmYes:  { color: '#e53e3e' },

  // Misc
  emptyText:      { fontFamily: Fonts.mono, fontSize: 12, color: LightTheme.muted },
  notSignedIn:    { fontFamily: Fonts.display, fontSize: 13, color: LightTheme.muted },
})
