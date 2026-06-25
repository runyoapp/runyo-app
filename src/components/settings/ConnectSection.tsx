import { useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Svg, { Rect, Line, Path } from 'react-native-svg'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { syncActivitiesToSheet } from '@/services/sheets'
import { createExportSheet } from '@/services/drive'
import { createSchema, deleteSchema } from '@/services/schemas'
import type { SchemaMeta } from '@/stores/dataStore'
import { effectiveSpan } from '@/utils/schemaRouting'
import { fromDateString, MONTHS_NL } from '@/utils/date'
import type { Activity } from '@/types/activity'
import { ImportWizard } from '@/screens/import/ImportWizard'
import { SchemaEditModal } from './SchemaEditModal'
import { Fonts, schemaColor } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { SectionLabel, Card, Divider, ActionRow } from './ui'

// "12 weken · start 1 sep" — toont altijd een waarde (afgeleid bij een legacy-schema).
function spanTextFor(schema: SchemaMeta, activities: Activity[]): string {
  const sp = effectiveSpan(activities, schema)
  const d = fromDateString(sp.start)
  return `${sp.weeks} ${sp.weeks === 1 ? 'week' : 'weken'} · start ${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
}

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

// ── Mijn schema's rij — puur weergave; tik opent de bewerkmodal ────────────
function SchemaRow({ s, last, spanText, dotColor, onPress }: {
  s: SchemaMeta
  last: boolean
  spanText: string
  dotColor: string
  onPress: () => void
}) {
  const theme = useTheme()
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.schemaRow, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
    >
      {/* Gevulde stip in de schemakleur = weergegeven; outline = niet weergegeven */}
      <View style={[styles.dot, { borderColor: s.isVisible ? dotColor : theme.faint }]}>
        {s.isVisible && <View style={[styles.dotFill, { backgroundColor: dotColor }]} />}
      </View>

      <View style={styles.schemaBody}>
        <Text style={[styles.schemaName, { color: theme.text }, s.isArchived && { color: theme.muted }]} numberOfLines={1}>
          {s.name}
        </Text>
        <Text style={[styles.schemaSpan, { color: theme.muted }]} numberOfLines={1}>{spanText}</Text>
      </View>

      <Text style={[styles.rowChevron, { color: theme.muted }]}>›</Text>
    </TouchableOpacity>
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
  const activateImport    = useDataStore(s => s.activateImport)
  const showToast         = useUiStore(s => s.showToast)

  const [open,           setOpen]           = useState(false)
  const [archivedOpen,   setArchivedOpen]   = useState(false)
  const [importOpen,     setImportOpen]     = useState(false)
  const [creating,       setCreating]       = useState(false)
  const [exporting,      setExporting]      = useState(false)
  const [schemasLoading, setSchemasLoading] = useState(false)
  const [editSchemaId,   setEditSchemaId]   = useState<string | null>(null)

  const editSchema = schemaList.find(s => s.id === editSchemaId) ?? null

  // Gearchiveerde schema's apart: ze blijven bereikbaar (terugzetten kan), maar
  // niet als lange grijze lijst tussen de actieve schema's. Ze zitten ingeklapt
  // achter een "Gearchiveerd (n)"-rij.
  const activeSchemas   = schemaList.filter(s => !s.isArchived)
  const archivedSchemas = schemaList.filter(s => s.isArchived)

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
      // Net als bij verwijderen: even ongedaan kunnen maken. Tik je binnen 5s op
      // "Ongedaan maken", dan halen we het zojuist aangemaakte schema weer weg.
      showToast('Leeg schema aangemaakt', 5000, {
        label: 'Ongedaan maken',
        onPress: async () => {
          try {
            await deleteSchema(id)
            await loadMySchemas()
          } catch {
            showToast('Ongedaan maken mislukt, probeer opnieuw.')
          }
        },
      })
    } catch {
      showToast('Aanmaken mislukt')
    } finally {
      setCreating(false)
    }
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
                <Text style={[styles.countText, { color: theme.accentInk }]}>{activeSchemas.length}</Text>
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
              <>
                {activeSchemas.map((sc, i) => (
                  <SchemaRow
                    key={sc.id}
                    s={sc}
                    last={i === activeSchemas.length - 1 && archivedSchemas.length === 0}
                    spanText={spanTextFor(sc, activities)}
                    dotColor={schemaColor(sc, schemaList)}
                    onPress={() => setEditSchemaId(sc.id)}
                  />
                ))}

                {archivedSchemas.length > 0 && (
                  <>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setArchivedOpen(o => !o)}
                      style={styles.archivedToggle}
                    >
                      <Text style={[styles.archivedToggleText, { color: theme.muted }]}>
                        Gearchiveerd ({archivedSchemas.length})
                      </Text>
                      <Chevron open={archivedOpen} color={theme.muted} />
                    </TouchableOpacity>

                    {archivedOpen && archivedSchemas.map((sc, i) => (
                      <SchemaRow
                        key={sc.id}
                        s={sc}
                        last={i === archivedSchemas.length - 1}
                        spanText={spanTextFor(sc, activities)}
                        dotColor={schemaColor(sc, schemaList)}
                        onPress={() => setEditSchemaId(sc.id)}
                      />
                    ))}
                  </>
                )}
              </>
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

      <SchemaEditModal
        schema={editSchema}
        visible={editSchema !== null}
        onClose={() => setEditSchemaId(null)}
        onExport={handleExportToSheets}
        exporting={exporting}
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
  schemaSpan:     { fontFamily: Fonts.mono, fontSize: 11, marginTop: 2 },
  rowChevron:     { fontFamily: Fonts.display, fontSize: 18 },

  archivedToggle:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  archivedToggleText: { fontFamily: Fonts.monoMedium, fontSize: 11, letterSpacing: 0.3, textTransform: 'uppercase' },

  emptyText:      { fontFamily: Fonts.mono, fontSize: 12, padding: 14 },
  notSignedIn:    { fontFamily: Fonts.display, fontSize: 13 },
})
