import { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native'
import { Fonts, Spacing, Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

const EMOJIS = ['😵', '😓', '😐', '💪', '🔥']

type Props = {
  existing: string | null
  onSubmit: (rating: number, text: string) => Promise<void>
  onCancel?: () => void
}

// Beoordeling-string → { rating, note }. Format: "4/5 💪 – optionele notitie"
export function parseFeedback(feedback: string | null): { rating: number; note: string } {
  if (!feedback) return { rating: 0, note: '' }
  const ratingMatch = feedback.match(/^(\d)/)
  const noteMatch   = feedback.match(/–\s*(.+)$/)
  return {
    rating: ratingMatch ? parseInt(ratingMatch[1]) : 0,
    note:   noteMatch ? noteMatch[1] : '',
  }
}

function parseExisting(existing: string | null): { rating: number; text: string } {
  const { rating, note } = parseFeedback(existing)
  return { rating, text: note }
}

export function FeedbackSection({ existing, onSubmit, onCancel }: Props) {
  const theme    = useTheme()
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
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <Text style={[styles.title, { color: theme.text }]}>Hoe was je training?</Text>
      <View style={styles.stars}>
        {EMOJIS.map((emoji, i) => {
          const val = i + 1
          return (
            <TouchableOpacity
              key={val}
              style={[styles.starBtn, { backgroundColor: rating >= val ? theme.accentGlow : theme.bgAlt }]}
              onPress={() => setRating(val)}
            >
              <Text style={styles.starEmoji}>{emoji}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
      <TextInput
        style={[styles.textarea, { color: theme.text, backgroundColor: theme.bg }]}
        placeholder="Optionele notitie..."
        placeholderTextColor={theme.faint}
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={3}
      />
      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: theme.accent }, (!rating || saving) && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!rating || saving}
      >
        <Text style={styles.submitBtnText}>
          {saving ? '…' : isEdit ? 'Bijwerken' : 'Opslaan'}
        </Text>
      </TouchableOpacity>
      {isEdit && onCancel && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={[styles.cancelBtnText, { color: theme.muted }]}>Annuleren</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export function FeedbackDisplay({ feedback, onEdit }: { feedback: string; onEdit: () => void }) {
  const theme = useTheme()
  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.displayHeader}>
        <Text style={[styles.displayLabel, { color: theme.muted }]}>Beoordeling opgeslagen</Text>
        <TouchableOpacity onPress={onEdit}>
          <Text style={[styles.editLink, { color: theme.accent }]}>Bewerken</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.displayText, { color: theme.text }]}>{feedback}</Text>
    </View>
  )
}

// Compacte beoordeling-weergave — gebruikt op de Vandaag-hero en in de uitgeklapte plan-rij.
// Vervangt de "Beoordeel"-knop zodra er een beoordeling is. Tikbaar → bewerken (als onPress meegegeven).
export function FeedbackBadge({ feedback, onPress }: { feedback: string; onPress?: () => void }) {
  const theme = useTheme()
  const { rating, note } = parseFeedback(feedback)
  const Wrapper: any = onPress ? TouchableOpacity : View
  return (
    <Wrapper
      style={[styles.badge, { backgroundColor: theme.accentGlow }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={styles.badgeEmoji}>{EMOJIS[rating - 1] ?? '✓'}</Text>
      <View style={styles.badgeBody}>
        <Text style={[styles.badgeLabel, { color: theme.accent }]}>Jouw beoordeling</Text>
        {!!note && (
          <Text style={[styles.badgeNote, { color: theme.text }]} numberOfLines={2}>{note}</Text>
        )}
      </View>
      {onPress && <Text style={[styles.badgeEdit, { color: theme.accent }]}>Bewerken</Text>}
    </Wrapper>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  badgeEmoji: { fontSize: 22 },
  badgeBody:  { flex: 1, gap: 1 },
  badgeLabel: { fontFamily: Fonts.displaySemiBold, fontSize: 12, letterSpacing: -0.1 },
  badgeNote:  { fontFamily: Fonts.display, fontSize: 14, lineHeight: 19 },
  badgeEdit:  { fontFamily: Fonts.displayMedium, fontSize: 13 },
  container: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 15,
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
  },
  starEmoji: { fontSize: 22 },
  textarea: {
    fontFamily: Fonts.display,
    fontSize: 14,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },
  submitBtn: {
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
  },
  editLink: {
    fontFamily: Fonts.displayMedium,
    fontSize: 13,
  },
  displayText: {
    fontFamily: Fonts.display,
    fontSize: 14,
    lineHeight: 20,
  },
})
