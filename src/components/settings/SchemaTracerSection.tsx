import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { createSchema } from '@/services/schemas'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

// TODO(1.2e/2.1): tracer UI — vervang door echte schema-aware flow.
// Tijdelijke zichtbare zone bovenop SettingsScreen die de backend-schemaId
// roundtrip aantoont; raakt de bestaande Sheets-flow niet.
export function SchemaTracerSection() {
  const theme           = useTheme()
  const tokenSet        = useAuthStore(s => s.tokenSet)
  const schemaId      = useDataStore(s => s.schemaId)
  const loadMySchemas = useDataStore(s => s.loadMySchemas)
  const showToast     = useUiStore(s => s.showToast)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!tokenSet) return
    loadMySchemas().catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'onbekend'
      // Silent: tracer mag niet storen. Toast alleen bij echte 401-flow.
      if (msg.includes('unauthorized')) showToast('Sessie verlopen — log opnieuw in')
    })
  }, [tokenSet, loadMySchemas, showToast])

  async function handleCreate() {
    setLoading(true)
    try {
      await createSchema()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'onbekend'
      showToast(`schema aanmaken mislukt: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  if (!tokenSet) {
    return (
      <View style={styles.row}>
        <Text style={[styles.body, { color: theme.muted }]}>Log in om de schema-tracer te zien.</Text>
      </View>
    )
  }

  if (schemaId === null) {
    return (
      <View style={styles.row}>
        <Text style={styles.body}>Nog geen schema</Text>
        <TouchableOpacity style={styles.btn} onPress={handleCreate} disabled={loading} activeOpacity={0.8}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Maak schema</Text>}
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.row}>
      <Text style={styles.body}>Schema: 0 trainingen</Text>
      <Text style={[styles.idHint, { color: theme.muted }]}>{schemaId.slice(0, 8)}…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  body: {
    fontFamily: Fonts.displayMedium,
    fontSize: 15,
    color: LightTheme.text,
  },
  idHint: {
    fontFamily: Fonts.displayMedium,
    fontSize: 12,
  },
  btn: {
    backgroundColor: '#00B98E',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
  },
  btnText: {
    fontFamily: Fonts.displayBold,
    fontSize: 13,
    color: '#062019',
  },
})
