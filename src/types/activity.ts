import type { ActivityType } from '@/constants/activities'

export type { ActivityType }

// Eén intervalblok in de weekbouwer. `repeat` = "herhaal blok xN"; een blok
// heeft een afstand (distanceKm) óf een duur (durationMin). pace en recovery
// zijn vrije tekst ("4:30", "90s dribbel"). Opgeslagen als jsonb-array in de
// backend (activities.intervals).
export type IntervalBlock = {
  id: string
  label: string | null
  repeat: number
  distanceKm: number | null
  durationMin: number | null
  pace: string | null
  recovery: string | null
}

export type Activity = {
  id: string
  schemaId: string     // backend-schema waar deze activiteit bij hoort (multi-schema)
  datum: string        // YYYY-MM-DD
  type: ActivityType
  titel: string
  detail: string
  km: number | null
  feedback: string | null
  fase: string | null
  rating: number | null
  updatedAt: string    // ISO timestamp
  createdAt: string    // ISO timestamp
  // Race-specifiek (alleen gevuld bij type 'race')
  raceType: string | null
  goalTime: string | null   // doeltijd, vrije tekst bv. "37:30"
  isMainGoal: boolean       // gemarkeerd als hoofddoel
  rowIndex: number | null   // 1-based sheet row index (null for unsaved)
  // Sessie-velden uit de weekbouwer (alleen gevuld voor trainingen)
  targetPace: string | null    // doeltempo, vrije tekst bv. "4:30"
  targetHr: number | null      // doelhartslag
  intervals: IntervalBlock[] | null
}

export type PersonalRecord = {
  distance: string     // e.g. "5k", "10k", "HM", "M"
  time: string         // e.g. "22:30"
}

export type Race = {
  id: string
  name: string
  date: string         // YYYY-MM-DD
  distance: string
  goal: string | null
  result: string | null
}

export type FeedbackEntry = {
  datum: string
  rating: number
  feedback: string
}
