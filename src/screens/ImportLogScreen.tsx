import { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
  Platform,
  Linking,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useFocusEffect } from '@react-navigation/native'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { getImportLog, downloadImportFile, type ImportLogEntry } from '@/services/ai'

function formatTs(ts: string): string {
  const d = new Date(ts)
  const date = d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const time = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Geschatte kosten obv het sonnet-4-6-tarief (USD per miljoen tokens).
// TODO: tarief bevestigen tegen de actuele Anthropic-prijslijst.
const USD_PER_MTOK_IN = 3
const USD_PER_MTOK_OUT = 15

function estimateCostUsd(inTok: number | null, outTok: number | null): number {
  return ((inTok ?? 0) / 1e6) * USD_PER_MTOK_IN + ((outTok ?? 0) / 1e6) * USD_PER_MTOK_OUT
}

function formatCost(usd: number): string {
  if (usd < 0.005) return '<$0,01'
  return `$${usd.toFixed(2).replace('.', ',')}`
}

function isUrl(s: string | null): boolean {
  return !!s && /^https?:\/\//i.test(s)
}

function EntryCard({ entry }: { entry: ImportLogEntry }) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)

  const statusColor = entry.ok ? theme.accent : theme.danger
  const statusLabel = entry.ok ? '✓' : '✗'

  // Stats-regel: rijen/titel alleen bij geslaagde imports; tokens + geschatte
  // kosten zodra ze gelogd zijn (ook bij afgebroken imports met partieel gebruik).
  const statParts: string[] = []
  if (entry.ok && entry.rowCount != null) statParts.push(`${entry.rowCount} trainingen`)
  if (entry.ok && entry.schemaTitle) statParts.push(entry.schemaTitle)
  if (entry.inputTokens || entry.outputTokens) {
    statParts.push(`${((entry.inputTokens ?? 0) / 1000).toFixed(1)}k → ${((entry.outputTokens ?? 0) / 1000).toFixed(1)}k tok`)
    statParts.push(formatCost(estimateCostUsd(entry.inputTokens, entry.outputTokens)))
  }

  async function download() {
    if (Platform.OS !== 'web') {
      Alert.alert('Alleen op web', 'Bestanden downloaden kan momenteel alleen via de webversie.')
      return
    }
    try {
      await downloadImportFile(entry.id, entry.fileName)
    } catch (e: unknown) {
      Alert.alert('Download mislukt', e instanceof Error ? e.message : 'Onbekende fout')
    }
  }

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.8}
    >
      {/* Header row */}
      <View style={styles.cardHeader}>
        <Text style={[styles.statusBadge, { color: statusColor }]}>{statusLabel}</Text>
        <View style={styles.cardMeta}>
          <Text style={[styles.ts, { color: theme.text }]}>{formatTs(entry.ts)}</Text>
          <Text style={[styles.metaLine, { color: theme.muted }]}>
            {entry.email ?? 'niet ingelogd'} · {entry.ip}
          </Text>
        </View>
      </View>

      {/* File row */}
      {entry.fileName && (
        <Text style={[styles.fileName, { color: theme.text2 }]} numberOfLines={expanded ? 3 : 1}>
          {entry.fileName}
          {entry.fileMime ? `  ·  ${entry.fileMime.split('/')[1] ?? entry.fileMime}` : ''}
          {entry.fileSize ? `  ·  ${formatBytes(entry.fileSize)}` : ''}
        </Text>
      )}

      {/* Error */}
      {!entry.ok && entry.error && (
        <Text style={[styles.errorLine, { color: theme.danger }]}>{entry.error}</Text>
      )}

      {/* Stats — rijen/titel + tokens + geschatte kosten */}
      {statParts.length > 0 && (
        <Text style={[styles.statsLine, { color: theme.muted }]}>{statParts.join('  ·  ')}</Text>
      )}

      {/* Expanded: raw preview + bron-knop */}
      {expanded && (
        <View style={styles.expandedBlock}>
          {entry.hasFile && (
            <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: theme.accentGlow }]} onPress={download}>
              <Text style={[styles.downloadBtnText, { color: theme.accent }]}>bestand downloaden</Text>
            </TouchableOpacity>
          )}
          {!entry.hasFile && isUrl(entry.fileName) && (
            <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: theme.accentGlow }]} onPress={() => Linking.openURL(entry.fileName as string)}>
              <Text style={[styles.downloadBtnText, { color: theme.accent }]}>sheet openen</Text>
            </TouchableOpacity>
          )}
          {entry.rawPreview ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rawScroll}>
              <Text style={[styles.rawText, { color: theme.muted }]}>{entry.rawPreview}</Text>
            </ScrollView>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  )
}

export function ImportLogScreen() {
  const insets     = useSafeAreaInsets()
  const navigation = useNavigation()
  const theme      = useTheme()
  const [entries, setEntries]     = useState<ImportLogEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const data = await getImportLog()
      setEntries(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ophalen mislukt')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const totalUsd = entries.reduce((sum, e) => sum + estimateCostUsd(e.inputTokens, e.outputTokens), 0)

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      {/* Title bar */}
      <View style={styles.titleRow}>
        <View>
          <Text style={[styles.pageTitle, { color: theme.text }]}>importeerlog</Text>
          {entries.length > 0 && (
            <Text style={[styles.subTitle, { color: theme.muted }]}>
              {entries.length} imports  ·  ~{formatCost(totalUsd)} totaal
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={[styles.closeBtnText, { color: theme.muted }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorMsg, { color: theme.danger }]}>{error}</Text>
          <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
            <Text style={[styles.retryText, { color: theme.accent }]}>opnieuw proberen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxl }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={theme.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {entries.length === 0 ? (
            <Text style={[styles.empty, { color: theme.muted }]}>nog geen imports</Text>
          ) : (
            entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  titleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  pageTitle:   { fontFamily: Fonts.displayBold, fontSize: 28, color: LightTheme.text, letterSpacing: -0.5 },
  subTitle:    { fontFamily: Fonts.mono, fontSize: 11, marginTop: 2 },
  closeBtn:    { padding: Spacing.sm },
  closeBtnText:{ fontFamily: Fonts.display, fontSize: 20, color: LightTheme.muted },
  scroll:      { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  empty:       { fontFamily: Fonts.displayMedium, fontSize: 15, textAlign: 'center', marginTop: Spacing.xxl },
  errorMsg:    { fontFamily: Fonts.displayMedium, fontSize: 15, textAlign: 'center' },
  retryBtn:    { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg },
  retryText:   { fontFamily: Fonts.displaySemiBold, fontSize: 14 },

  card:        { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, gap: 6 },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  statusBadge: { fontFamily: Fonts.displayBold, fontSize: 16, width: 20, textAlign: 'center' },
  cardMeta:    { flex: 1, gap: 2 },
  ts:          { fontFamily: Fonts.mono, fontSize: 13 },
  metaLine:    { fontFamily: Fonts.mono, fontSize: 11 },
  fileName:    { fontFamily: Fonts.displayMedium, fontSize: 13, paddingLeft: 28 },
  errorLine:   { fontFamily: Fonts.displayMedium, fontSize: 13, paddingLeft: 28 },
  statsLine:   { fontFamily: Fonts.mono, fontSize: 11, paddingLeft: 28 },

  expandedBlock: { marginTop: Spacing.sm, gap: Spacing.sm },
  downloadBtn:   { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: Spacing.md, borderRadius: Radius.sm },
  downloadBtnText: { fontFamily: Fonts.displaySemiBold, fontSize: 13 },
  rawScroll:     { maxHeight: 200 },
  rawText:       { fontFamily: Fonts.mono, fontSize: 11, lineHeight: 18 },
})
