import { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native'
import { LightTheme, Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

const EMOJIS = ['😵', '😓', '😐', '💪', '🔥']

type Props = {
  existing: string | null
  onSubmit: (rating: number, text: string) => Promise<void>
  onCancel?: () => void
}

function parseExisting(existing: string | null): { rating: number; text: string } {
  if (!existing) return { rating: 0, text: '' }
  const ratingMatch = existing.match(/^(\d)/)
  const textMatch   = existing.match(/–\s*(.+)$/)
  return {
    rating: ratingMatch ? parseInt(ratingMatch[1]) : 0,
    text:   textMatch ? textMatch[1] : '',
  }
}

export function FeedbackSection({ existing, onSubmit, onCancel }: Props) {
  const parsed  = parseExisting(existing)
  const [rating, setRating] = useState(parsed.rating)
  const [text,   setText]   = useState(parsed.text)
  const [saving, setSaving] = useState(false)
  const isEdit = !!existing

  async function handleSubmit() {
    if (!rating) return
    setSaving(true)
    await onSubmit(rating, text)
    setSaving(false)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hoe was je training?</Text>
      <View style={styles.stars}>
        {EMOJIS.map((emoji, i) => {
          const val = i + 1
          return (
            <TouchableOpacity
              key={val}
              style={[styles.starBtn, rating >= val && styles.starBtnActive]}
              onPress={() => setRating(val)}
            >
              <Text style={styles.starEmoji}>{emoji}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
      <TextInput
        style={styles.textarea}
        placeholder="Optionele notitie..."
        placeholderTextColor={LightTheme.faint}
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={3}
      />
      <TouchableOpacity
        style={[styles.submitBtn, (!rating || saving) && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!rating || saving}
      >
        <Text style={styles.submitBtnText}>
          {saving ? '…' : isEdit ? 'Bijwerken' : 'Opslaan'}
        </Text>
      </TouchableOpacity>
      {isEdit && onCancel && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Annuleren</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export function FeedbackDisplay({ feedback, onEdit }: { feedback: string; onEdit: () => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.displayHeader}>
        <Text style={styles.displayLabel}>Beoordeling opgeslagen</Text>
        <TouchableOpacity onPress={onEdit}>
          <Text style={styles.editLink}>Bewerken</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.displayText}>{feedback}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: LightTheme.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 15,
    color: LightTheme.text,
    marginBottom: Spacing.md,
  },
  stars: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  starBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: LightTheme.bgAlt,
  },
  starBtnActive: {
    backgroundColor: LightTheme.accentGlow,
  },
  starEmoji: { fontSize: 22 },
  textarea: {
    fontFamily: Fonts.display,
    fontSize: 14,
    color: LightTheme.text,
    backgroundColor: LightTheme.bg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },
  submitBtn: {
    backgroundColor: LightTheme.accent,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 15,
    color: '#fff',
  },
  cancelBtn: {
    marginTop: Spacing.sm,
    alignItems: 'center',
    padding: Spacing.sm,
  },
  cancelBtnText: {
    fontFamily: Fonts.display,
    fontSize: 14,
    color: LightTheme.muted,
  },
  displayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  displayLabel: {
    fontFamily: Fonts.displayMedium,
    fontSize: 13,
    color: LightTheme.muted,
  },
  editLink: {
    fontFamily: Fonts.displayMedium,
    fontSize: 13,
    color: LightTheme.accent,
  },
  displayText: {
    fontFamily: Fonts.display,
    fontSize: 14,
    color: LightTheme.text,
    lineHeight: 20,
  },
})
