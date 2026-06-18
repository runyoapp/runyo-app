import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { ModalSheet } from '@/components/shared/ModalSheet'
import { FieldLabel, EditorTextField, Toggle, SaveBar } from '@/components/shared/editor'
import { Divider, ActionRow } from './ui'
import { WeekRangePicker } from '@/components/shared/WeekRangePicker'
import { useTheme } from '@/hooks/useTheme'
import { useDataStore, type SchemaMeta } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { renameSchema } from '@/services/schemas'
import { effectiveSpan } from '@/utils/schemaRouting'
import { fromDateString, MONTHS_NL } from '@/utils/date'
import { Fonts, Spacing, SchemaPalette, schemaColor } from '@/constants/theme'

type Props = {
  schema: SchemaMeta | null
  visible: boolean
  onClose: () => void
  onExport: (schema: SchemaMeta) => void
  exporting: boolean
}

function fmt(iso: string): string {
  const d = fromDateString(iso)
  return `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
}

export function SchemaEditModal({ schema, visible, onClose, onExport, exporting }: Props) {
  const theme              = useTheme()
  const activities         = useDataStore(s => s.activities)
  const schemaList         = useDataStore(s => s.schemaList)
  const setSchemaVisible   = useDataStore(s => s.setSchemaVisible)
  const setSchemaSpanById  = useDataStore(s => s.setSchemaSpanById)
  const setSchemaColorById = useDataStore(s => s.setSchemaColorById)
  const archiveSchemaById  = useDataStore(s => s.archiveSchemaById)
  const loadMySchemas      = useDataStore(s => s.loadMySchemas)
  const showToast          = useUiStore(s => s.showToast)

  const [name,     setName]     = useState('')
  const [shown,    setShown]    = useState(true)
  const [color,    setColor]    = useState('#00B98E')
  const [startMon, setStartMon] = useState('')
  const [weekCount, setWeekCount] = useState(1)
  const [saving,   setSaving]   = useState(false)

  // Resetten telkens als de modal opent voor een (ander) schema.
  useEffect(() => {
    if (!visible || !schema) return
    const sp = effectiveSpan(activities, schema)
    setName(schema.name)
    setShown(schema.isVisible)
    setColor(schemaColor(schema, schemaList))
    setStartMon(sp.start)
    setWeekCount(sp.weeks)
    setSaving(false)
  }, [visible, schema?.id])

  if (!schema) return null

  const subtitle = `${weekCount} ${weekCount === 1 ? 'week' : 'weken'} · start ${fmt(startMon)}`

  async function handleSave() {
    if (!schema) return
    setSaving(true)
    try {
      const trimmed = name.trim()
      if (trimmed && trimmed !== schema.name) await renameSchema(schema.id, trimmed)
      if (!schema.isArchived && shown !== schema.isVisible) await setSchemaVisible(schema.id, shown)
      if (color !== schema.color) await setSchemaColorById(schema.id, color)
      if (startMon !== schema.startDate || weekCount !== schema.weekCount) {
        await setSchemaSpanById(schema.id, { startDate: startMon, weekCount })
      }
      await loadMySchemas()
      showToast('✓ Schema bijgewerkt')
      onClose()
    } catch {
      showToast('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchiveToggle() {
    if (!schema) return
    try {
      await archiveSchemaById(schema.id, !schema.isArchived)
      showToast(schema.isArchived ? `${schema.name} teruggezet` : `${schema.name} gearchiveerd`)
      onClose()
    } catch {
      showToast('Wijzigen mislukt')
    }
  }

  return (
    <ModalSheet
      visible={visible}
      title={schema.name || 'Schema'}
      subtitle={subtitle}
      accentDot={color}
      onClose={onClose}
      footer={<SaveBar label="Opslaan" onSave={handleSave} onCancel={onClose} saving={saving} />}
    >
      <View style={{ gap: Spacing.lg }}>
        <View>
          <FieldLabel>Naam</FieldLabel>
          <EditorTextField value={name} onChangeText={setName} placeholder="Schemanaam" />
        </View>

        {!schema.isArchived && (
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>Weergeven</Text>
              <Text style={[styles.toggleSub, { color: theme.muted }]}>
                Toon dit schema in je views en notificaties.
              </Text>
            </View>
            <Toggle on={shown} onChange={setShown} />
          </View>
        )}

        <View>
          <FieldLabel>Kleur</FieldLabel>
          <View style={styles.swatchRow}>
            {SchemaPalette.map(hex => {
              const sel = hex === color
              return (
                <TouchableOpacity
                  key={hex}
                  activeOpacity={0.8}
                  onPress={() => setColor(hex)}
                  style={[
                    styles.swatch,
                    { backgroundColor: hex, borderColor: sel ? theme.text : 'transparent' },
                  ]}
                />
              )
            })}
          </View>
        </View>

        <View>
          <FieldLabel hint="· begin- en eindweek">Looptijd</FieldLabel>
          <WeekRangePicker
            t={theme}
            startDate={startMon}
            weekCount={weekCount}
            onChange={(sd, wc) => { setStartMon(sd); setWeekCount(wc) }}
          />
        </View>

        <Divider />

        <View style={styles.actions}>
          <ActionRow
            icon="↗"
            title="Exporteren naar Sheets"
            sub="Kopieer dit schema naar Google Sheets"
            chevron={false}
            onPress={exporting ? undefined : () => onExport(schema)}
          />
          <ActionRow
            icon={schema.isArchived ? '↩' : '📦'}
            title={schema.isArchived ? 'Terugzetten' : 'Archiveren'}
            sub={schema.isArchived ? 'Haal dit schema terug uit het archief' : 'Uit beeld halen zonder data te wissen'}
            chevron={false}
            onPress={handleArchiveToggle}
          />
        </View>
      </View>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  toggleRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTitle: { fontFamily: Fonts.displaySemiBold, fontSize: 14.5, letterSpacing: -0.1 },
  toggleSub:   { fontFamily: Fonts.display, fontSize: 12, marginTop: 2 },
  swatchRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch:      { width: 34, height: 34, borderRadius: 999, borderWidth: 2 },
  actions:     { gap: 4 },
})
