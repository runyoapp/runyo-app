import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { patchActivity, deleteActivity } from '@/services/activities'
import { PageContainer } from '@/components/shared/PageContainer'
import {
  FieldLabel, EditorTextField, EditorTextArea, DistanceStepper,
} from '@/components/shared/editor'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import { runCategory, activityColor } from '@/utils/runCategory'
import type { Activity, IntervalBlock } from '@/types/activity'

type Props = {
  activity: Activity
  onBack: () => void
}

let blockSeq = 0
function newBlock(): IntervalBlock {
  blockSeq += 1
  return {
    id: `wb-${Date.now()}-${blockSeq}`,
    label: null, repeat: 1, distanceKm: null, durationMin: null, pace: null, recovery: null,
  }
}

export function EditorScreen({ activity, onBack }: Props) {
  const theme          = useTheme()
  const insets         = useSafeAreaInsets()
  const schemaId       = useDataStore(s => s.schemaId)
  const upsertActivity = useDataStore(s => s.upsertActivity)
  const removeActivity = useDataStore(s => s.removeActivity)
  const showToast      = useUiStore(s => s.showToast)
  const queryClient    = useQueryClient()

  const [km,         setKm]         = useState(activity.km ?? 0)
  const [titel,      setTitel]      = useState(activity.titel)
  const [detail,     setDetail]     = useState(activity.detail)
  const [targetPace, setTargetPace] = useState(activity.targetPace ?? '')
  const [targetHr,   setTargetHr]   = useState(activity.targetHr != null ? String(activity.targetHr) : '')
  const [intervals,  setIntervals]  = useState<IntervalBlock[]>(activity.intervals ?? [])
  const [openBlock,  setOpenBlock]  = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)

  const showIntervals = runCategory(activity) === 'tempo'

  function patchBlock(id: string, patch: Partial<IntervalBlock>) {
    setIntervals(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b))
  }
  function removeBlock(id: string) {
    setIntervals(prev => prev.filter(b => b.id !== id))
  }
  function addBlock() {
    const b = newBlock()
    setIntervals(prev => [...prev, b])
    setOpenBlock(b.id)
  }

  async function handleSave() {
    if (!schemaId || saving) return
    setSaving(true)
    const hrNum = targetHr.trim() ? Number(targetHr.trim()) : null
    const patch = {
      km: km > 0 ? km : null,
      titel: titel || null,
      detail: detail || null,
      targetPace: targetPace.trim() || null,
      targetHr: hrNum != null && !Number.isNaN(hrNum) ? hrNum : null,
      intervals: intervals.length ? intervals : null,
    }
    const optimistic: Activity = {
      ...activity,
      km: patch.km,
      titel: patch.titel ?? '',
      detail: patch.detail ?? '',
      targetPace: patch.targetPace,
      targetHr: patch.targetHr,
      intervals: patch.intervals,
    }
    upsertActivity(optimistic)
    try {
      const updated = await patchActivity(schemaId, activity.id, patch)
      upsertActivity(updated)
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast('Opgeslagen')
      onBack()
    } catch {
      upsertActivity(activity)
      showToast('Opslaan mislukt, probeer opnieuw.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!schemaId) return
    removeActivity(activity.id)
    onBack()
    try {
      await deleteActivity(schemaId, activity.id)
      await queryClient.invalidateQueries({ queryKey: ['activities', 'backend', schemaId] })
      showToast('Verwijderd')
    } catch {
      upsertActivity(activity)
      showToast('Verwijderen mislukt, probeer opnieuw.')
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <PageContainer>
        {/* Terug-header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.squareBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Text style={[styles.squareBtnText, { color: theme.text }]}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headMid}>
            <View style={[styles.headBar, { backgroundColor: activityColor(activity, theme) }]} />
            <Text style={[styles.headTitle, { color: theme.text }]} numberOfLines={1}>
              {titel || activity.type}
            </Text>
          </View>
          <TouchableOpacity onPress={handleDelete} activeOpacity={0.7}>
            <Text style={[styles.deleteLink, { color: theme.danger }]}>Verwijder</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Afstand */}
          <View style={styles.section}>
            <FieldLabel>Afstand</FieldLabel>
            <DistanceStepper value={km} onChange={setKm} />
          </View>

          {/* Pace + HR */}
          <View style={styles.paceRow}>
            <View style={{ flex: 1 }}>
              <FieldLabel>Streefpace</FieldLabel>
              <EditorTextField value={targetPace} onChangeText={setTargetPace} placeholder="4:30" mono />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel>Hartslag</FieldLabel>
              <EditorTextField value={targetHr} onChangeText={setTargetHr} placeholder="145" keyboardType="numeric" />
            </View>
          </View>

          {/* Intervallen — alleen voor kwaliteitssessies */}
          {showIntervals && (
            <View style={styles.section}>
              <FieldLabel hint={`${intervals.length} ${intervals.length === 1 ? 'blok' : 'blokken'}`}>
                Intervallen
              </FieldLabel>
              <View style={{ gap: 7 }}>
                {intervals.map(block => {
                  const open = openBlock === block.id
                  return (
                    <View
                      key={block.id}
                      style={[styles.block, { backgroundColor: theme.surface, borderColor: open ? theme.accent : theme.border }]}
                    >
                      <TouchableOpacity
                        style={styles.blockHead}
                        activeOpacity={0.7}
                        onPress={() => setOpenBlock(open ? null : block.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.blockTitle, { color: theme.text }]}>
                            {block.label || `Blok ${block.repeat}×`}
                          </Text>
                          <Text style={[styles.blockMeta, { color: theme.muted }]}>
                            {[
                              block.distanceKm != null ? `${block.distanceKm} km` : block.durationMin != null ? `${block.durationMin} min` : null,
                              block.pace ? `${block.pace}/km` : null,
                              block.recovery ? `${block.recovery} herstel` : null,
                            ].filter(Boolean).join(' · ') || 'tik om in te stellen'}
                          </Text>
                        </View>
                        <Text style={[styles.blockChevron, { color: open ? theme.accent : theme.muted }, open && styles.blockChevronOpen]}>›</Text>
                      </TouchableOpacity>

                      {open && (
                        <View style={[styles.blockBody, { borderTopColor: theme.border, backgroundColor: theme.surface2 }]}>
                          <FieldLabel>Label</FieldLabel>
                          <EditorTextField value={block.label ?? ''} onChangeText={v => patchBlock(block.id, { label: v || null })} placeholder="bv. Tempo-blok" />

                          <View style={[styles.paceRow, { marginTop: Spacing.md }]}>
                            <View style={{ flex: 1 }}>
                              <FieldLabel>Afstand (km)</FieldLabel>
                              <EditorTextField
                                value={block.distanceKm != null ? String(block.distanceKm) : ''}
                                onChangeText={v => patchBlock(block.id, { distanceKm: v.trim() ? Number(v) : null })}
                                placeholder="1" keyboardType="numeric" mono
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <FieldLabel>Duur (min)</FieldLabel>
                              <EditorTextField
                                value={block.durationMin != null ? String(block.durationMin) : ''}
                                onChangeText={v => patchBlock(block.id, { durationMin: v.trim() ? Number(v) : null })}
                                placeholder="5" keyboardType="numeric" mono
                              />
                            </View>
                          </View>

                          <View style={[styles.paceRow, { marginTop: Spacing.md }]}>
                            <View style={{ flex: 1 }}>
                              <FieldLabel>Pace</FieldLabel>
                              <EditorTextField value={block.pace ?? ''} onChangeText={v => patchBlock(block.id, { pace: v || null })} placeholder="4:30" mono />
                            </View>
                            <View style={{ flex: 1 }}>
                              <FieldLabel>Herstel</FieldLabel>
                              <EditorTextField value={block.recovery ?? ''} onChangeText={v => patchBlock(block.id, { recovery: v || null })} placeholder="2:00" mono />
                            </View>
                          </View>

                          {/* Herhaal-stepper */}
                          <View style={[styles.repeatRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.repeatTitle, { color: theme.text }]}>Herhaal dit blok</Text>
                              <Text style={[styles.repeatSub, { color: theme.muted }]}>kopieer intervallen + km</Text>
                            </View>
                            <View style={styles.stepGroup}>
                              <TouchableOpacity
                                style={[styles.stepBtn, { backgroundColor: theme.surface2, borderColor: theme.border }]}
                                onPress={() => patchBlock(block.id, { repeat: Math.max(1, block.repeat - 1) })}
                                activeOpacity={0.7}
                              >
                                <Text style={[styles.stepBtnText, { color: theme.text }]}>−</Text>
                              </TouchableOpacity>
                              <Text style={[styles.repeatVal, { color: theme.text }]}>{block.repeat}×</Text>
                              <TouchableOpacity
                                style={[styles.stepBtn, { backgroundColor: theme.surface2, borderColor: theme.border }]}
                                onPress={() => patchBlock(block.id, { repeat: block.repeat + 1 })}
                                activeOpacity={0.7}
                              >
                                <Text style={[styles.stepBtnText, { color: theme.text }]}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          <TouchableOpacity onPress={() => removeBlock(block.id)} activeOpacity={0.7} style={styles.removeBlock}>
                            <Text style={[styles.removeBlockText, { color: theme.danger }]}>Blok verwijderen</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>

              <TouchableOpacity
                style={[styles.addBlock, { borderColor: theme.border }]}
                onPress={addBlock}
                activeOpacity={0.7}
              >
                <Text style={[styles.addBlockText, { color: theme.accent }]}>+ Interval toevoegen</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Titel */}
          <View style={styles.section}>
            <FieldLabel>Titel</FieldLabel>
            <EditorTextField value={titel} onChangeText={setTitel} placeholder="bv. Tempo 4×1km" />
          </View>

          {/* Notitie */}
          <View style={styles.section}>
            <FieldLabel hint="· optioneel">Notitie</FieldLabel>
            <EditorTextArea value={detail} onChangeText={setDetail} placeholder="Notities, tempo, HR…" />
          </View>

          {/* Opslaan */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.accent }, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={[styles.saveText, { color: theme.accentInk }]}>{saving ? 'Opslaan…' : 'Opslaan'}</Text>
            <Text style={[styles.saveText, { color: theme.accentInk }]}>→</Text>
          </TouchableOpacity>

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </PageContainer>
    </View>
  )
}

const styles = StyleSheet.create({
  root:        { flex: 1 },

  header:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingTop: 6, paddingBottom: 10 },
  squareBtn:   { width: 32, height: 32, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  squareBtnText:{ fontFamily: Fonts.displaySemiBold, fontSize: 17, lineHeight: 20 },
  headMid:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headBar:     { width: 4, height: 28, borderRadius: 2 },
  headTitle:   { flex: 1, fontFamily: Fonts.displayBold, fontSize: 17, letterSpacing: -0.3 },
  deleteLink:  { fontFamily: Fonts.displaySemiBold, fontSize: 13 },

  scroll:      { paddingHorizontal: Spacing.lg, paddingTop: 4 },
  section:     { marginBottom: Spacing.lg },
  paceRow:     { flexDirection: 'row', gap: 10, marginBottom: Spacing.lg },

  block:       { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  blockHead:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  blockTitle:  { fontFamily: Fonts.displaySemiBold, fontSize: 13.5, letterSpacing: -0.1 },
  blockMeta:   { fontFamily: Fonts.mono, fontSize: 11, marginTop: 2 },
  blockChevron:{ fontFamily: Fonts.display, fontSize: 15 },
  blockChevronOpen:{ transform: [{ rotate: '90deg' }] },
  blockBody:   { borderTopWidth: 1, padding: 13 },

  repeatRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderRadius: 9, marginTop: Spacing.md },
  repeatTitle: { fontFamily: Fonts.displaySemiBold, fontSize: 13, letterSpacing: -0.1 },
  repeatSub:   { fontFamily: Fonts.display, fontSize: 11.5, marginTop: 1 },
  stepGroup:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn:     { width: 26, height: 26, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontFamily: Fonts.displaySemiBold, fontSize: 16, lineHeight: 18 },
  repeatVal:   { fontFamily: Fonts.displayBold, fontSize: 16, minWidth: 28, textAlign: 'center' },

  removeBlock: { alignSelf: 'flex-start', marginTop: Spacing.md, paddingVertical: 4 },
  removeBlockText:{ fontFamily: Fonts.displaySemiBold, fontSize: 12.5 },

  addBlock:    { marginTop: 10, paddingVertical: 11, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.md, alignItems: 'center' },
  addBlockText:{ fontFamily: Fonts.displaySemiBold, fontSize: 13 },

  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 16, borderRadius: Radius.lg, marginTop: 4 },
  saveText:    { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.1 },
})
