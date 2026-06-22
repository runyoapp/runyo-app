// runyo — gedeelde intervalblok-editor. Eén of meer blokken, elk met eigen
// herhaal-teller (bv. 2×400 + 3×800 = twee blokken). Losgeweekt uit de
// weekbouwer-EditorScreen zodat de weekbouwer én de DayDetailModal exact
// dezelfde editor delen. De aanroeper houdt de `intervals`-state en geeft
// onChange door; het in/uitklappen per blok zit hierbinnen.

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { FieldLabel, EditorTextField } from '@/components/shared/editor'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import type { IntervalBlock } from '@/types/activity'

let blockSeq = 0
export function newIntervalBlock(): IntervalBlock {
  blockSeq += 1
  return {
    id: `wb-${Date.now()}-${blockSeq}`,
    label: null, repeat: 1, distanceKm: null, durationMin: null, pace: null, recovery: null,
  }
}

export function IntervalEditor({ intervals, onChange }: {
  intervals: IntervalBlock[]
  onChange: (next: IntervalBlock[]) => void
}) {
  const theme = useTheme()
  const [openBlock, setOpenBlock] = useState<string | null>(null)

  function patchBlock(id: string, patch: Partial<IntervalBlock>) {
    onChange(intervals.map(b => b.id === id ? { ...b, ...patch } : b))
  }
  function removeBlock(id: string) {
    onChange(intervals.filter(b => b.id !== id))
  }
  function addBlock() {
    const b = newIntervalBlock()
    onChange([...intervals, b])
    setOpenBlock(b.id)
  }

  return (
    <View>
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
  )
}

const styles = StyleSheet.create({
  paceRow:     { flexDirection: 'row', gap: 10 },
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
})
