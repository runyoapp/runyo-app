import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDataStore } from '@/stores/dataStore'
import { useActivities } from '@/hooks/useActivities'
import { useTheme } from '@/hooks/useTheme'
import { AppHeader } from '@/components/shared/AppHeader'
import { PageContainer } from '@/components/shared/PageContainer'
import { RaceModal } from '@/screens/RaceModal'
import { RaceDetailModal } from '@/screens/RaceDetailModal'
import { AddActivityModal } from '@/screens/AddActivityModal'
import { SeasonRibbon } from '@/components/races/SeasonRibbon'
import { RaceHero } from '@/components/races/RaceHero'
import { RaceUpNextList } from '@/components/races/RaceUpNextList'
import { weekProgress } from '@/utils/raceProgress'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import type { Activity } from '@/types/activity'

export function RacesScreen() {
  const insets     = useSafeAreaInsets()
  const theme      = useTheme()
  const activities = useDataStore(s => s.activities)
  const schemaList = useDataStore(s => s.schemaList)
  useActivities()

  // detailRace = bestaande race bekijken (detail → bewerken); addRaceOpen = nieuwe
  // race; addOpen = generieke "+ activiteit" uit de header.
  const [detailRace, setDetailRace] = useState<Activity | null>(null)
  const [addRaceOpen, setAddRaceOpen] = useState(false)
  const [addOpen,     setAddOpen]     = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const races = activities
    .filter(a => a.type === 'race' && a.datum >= today)
    .sort((a, b) => a.datum.localeCompare(b.datum))

  const next   = races[0] ?? null
  const upNext = races.slice(1)

  const heroProgress = (() => {
    if (!next) return 0
    const p = weekProgress(next, schemaList, activities)
    return p ? p.done / p.total : 0
  })()

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <PageContainer>
        <AppHeader onAddPress={() => setAddOpen(true)} showRacesBar={false} />

        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: theme.text }]}>Races</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {races.length} {races.length === 1 ? 'race' : 'races'} dit seizoen · {upNext.length} te gaan
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {next ? (
            <>
              <SeasonRibbon races={races} />
              <View style={{ height: 14 }} />
              <RaceHero race={next} progress={heroProgress} onPress={() => setDetailRace(next)} />
              {upNext.length > 0 && (
                <RaceUpNextList races={upNext} onPress={setDetailRace} />
              )}
            </>
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Nog geen races gepland</Text>
              <Text style={[styles.emptyText, { color: theme.muted }]}>
                Voeg je eerstvolgende doel toe en zie de aftelteller verschijnen.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.text }]}
            onPress={() => setAddRaceOpen(true)}
            activeOpacity={0.85}
          >
            <Text style={[styles.addPlus, { color: theme.bg }]}>+</Text>
            <Text style={[styles.addLabel, { color: theme.bg }]}>Race toevoegen</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </PageContainer>

      <RaceDetailModal activity={detailRace} visible={!!detailRace} onClose={() => setDetailRace(null)} />
      <RaceModal activity={null} prefillDate={today} visible={addRaceOpen} onClose={() => setAddRaceOpen(false)} />
      <AddActivityModal visible={addOpen} prefillDate={today} onClose={() => setAddOpen(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  root:           { flex: 1 },
  titleBlock:     { paddingHorizontal: Spacing.lg, paddingTop: 4, paddingBottom: 12 },
  title:          { fontFamily: Fonts.displayBold, fontSize: 24, letterSpacing: -0.7 },
  subtitle:       { fontFamily: Fonts.display, fontSize: 12.5, marginTop: 1 },
  scroll:         { flex: 1 },
  scrollContent:  { paddingHorizontal: Spacing.lg, paddingTop: 2 },
  empty:          { paddingVertical: Spacing.xxl, alignItems: 'center', gap: Spacing.sm },
  emptyTitle:     { fontFamily: Fonts.displaySemiBold, fontSize: 16 },
  emptyText:      { fontFamily: Fonts.display, fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 280 },
  addBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center', borderRadius: Radius.pill, paddingHorizontal: 20, paddingVertical: 11, marginTop: 16, shadowColor: '#0E1F1A', shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  addPlus:        { fontFamily: Fonts.displaySemiBold, fontSize: 16, lineHeight: 18 },
  addLabel:       { fontFamily: Fonts.displayBold, fontSize: 13.5, letterSpacing: -0.15 },
})
