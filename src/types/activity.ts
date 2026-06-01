import type { ActivityType } from '@/constants/activities'

export type { ActivityType }

export type Activity = {
  id: string
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
