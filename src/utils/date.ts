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
