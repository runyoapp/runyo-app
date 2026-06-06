export const DAYS_NL  = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
export const DAYS_EN  = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
export const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
export const MONTHS_EN = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
export const MONTHS_FULL_NL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']
export const MONTHS_FULL_EN = ['january','february','march','april','may','june','july','august','september','october','november','december']

// Returns Monday-first day index (0 = Monday, 6 = Sunday)
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromDateString(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  const date = new Date(y, m - 1, d, 12, 0, 0, 0)
  return date
}

export function addDays(date: Date, n: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + n)
  return result
}

// Returns the date that is `dayOffset` days from today (noon, to avoid DST issues)
export function dateFromOffset(dayOffset: number): Date {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + dayOffset)
  return date
}

// Returns the Monday of the week containing `date`
export function weekStart(date: Date): Date {
  const dow = mondayIndex(date)
  return addDays(date, -dow)
}

export function dayOffsetFromDate(date: Date): number {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

export function formatDayLabel(date: Date, dayOffset: number, lang: 'nl' | 'en'): string {
  const days   = lang === 'en' ? DAYS_EN : DAYS_NL
  const months = lang === 'en' ? MONTHS_FULL_EN : MONTHS_FULL_NL
  if (dayOffset === 0) return `${days[mondayIndex(date)]} · vandaag`
  return `${days[mondayIndex(date)]} ${date.getDate()} ${months[date.getMonth()]}`
}

// Returns 7 YYYY-MM-DD strings for the week that is `weekOffset` weeks from now (Mon–Sun)
export function getWeekDates(weekOffset: number): string[] {
  const n = new Date()
  n.setHours(12, 0, 0, 0)
  n.setDate(n.getDate() + weekOffset * 7)
  const dow = n.getDay()
  n.setDate(n.getDate() - (dow === 0 ? 6 : dow - 1))  // rewind to Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(n)
    d.setDate(n.getDate() + i)
    return toDateString(d)
  })
}

// ISO 8601 week number
export function getISOWeekNumber(date: Date): number {
  const jan4 = new Date(date.getFullYear(), 0, 4)
  return Math.ceil(((date.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7)
}

// Race-countdown weergave. Regel: < 3 weken → dagen, 3–7 weken → weken,
// > 7 weken → maanden. Niets afgekort ('week'/'maand' voluit, geen 'wk').
export function raceCountdown(dateStr: string): { val: string; unit: string } {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const race  = fromDateString(dateStr); race.setHours(0, 0, 0, 0)
  const days  = Math.round((race.getTime() - today.getTime()) / 86400000)
  if (days < 0)    return { val: String(Math.abs(days)), unit: Math.abs(days) === 1 ? 'dag geleden' : 'dagen geleden' }
  if (days === 0)  return { val: 'vandaag', unit: '🏁' }
  if (days < 21)   return { val: String(days), unit: days === 1 ? 'dag' : 'dagen' }   // < 3 weken
  if (days <= 49) {                                                                    // 3–7 weken
    const weeks = Math.round(days / 7)
    return { val: String(weeks), unit: weeks === 1 ? 'week' : 'weken' }
  }
  const months = Math.round(days / 30)                                                 // > 7 weken
  return { val: String(months), unit: months === 1 ? 'maand' : 'maanden' }
}
