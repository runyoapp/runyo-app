export const ACTIVITY_TYPES = [
  'run', 'work', 'strength', 'mobility', 'rest',
  'race', 'recovery', 'swim', 'bike', 'gym',
] as const

export type ActivityType = typeof ACTIVITY_TYPES[number]

// Types die de gebruiker handmatig kan kiezen in de activiteit-editor. rust en
// werk zijn 'geen training' (auto-afgehandeld), en herstel hoort niet in de
// handmatige keuzelijst — die blijven dus uit de type-kiezer.
export const SELECTABLE_ACTIVITY_TYPES = ACTIVITY_TYPES.filter(
  t => t !== 'rest' && t !== 'recovery' && t !== 'work',
)

export const TYPE_NL_MAP: Record<string, ActivityType> = {
  hardlopen: 'run', lopen: 'run', rennen: 'run',
  werk: 'work', werken: 'work',
  kracht: 'strength', krachttraining: 'strength',
  mobiliteit: 'mobility', stretching: 'mobility',
  rust: 'rest', rustdag: 'rest',
  race: 'race', wedstrijd: 'race',
  herstel: 'recovery',
  zwemmen: 'swim', zwem: 'swim',
  fietsen: 'bike', fiets: 'bike',
  gym: 'gym',
}

export const TYPE_DISPLAY: Record<ActivityType, { nl: string; en: string }> = {
  run:      { nl: 'Hardlopen',  en: 'Run' },
  work:     { nl: 'Werk',       en: 'Work' },
  strength: { nl: 'Kracht',     en: 'Strength' },
  mobility: { nl: 'Mobiliteit', en: 'Mobility' },
  rest:     { nl: 'Rust',       en: 'Rest' },
  race:     { nl: 'Race',       en: 'Race' },
  recovery: { nl: 'Herstel',    en: 'Recovery' },
  swim:     { nl: 'Zwemmen',    en: 'Swim' },
  bike:     { nl: 'Fietsen',    en: 'Bike' },
  gym:      { nl: 'Gym',        en: 'Gym' },
}

export const WEATHER_CODES: Record<number, string> = {
  0: '☀️', 1: '🌤', 2: '⛅️', 3: '☁️',
  45: '🌫', 48: '🌫',
  51: '🌦', 53: '🌦', 55: '🌧',
  61: '🌧', 63: '🌧', 65: '🌧',
  71: '🌨', 73: '🌨', 75: '❄️',
  80: '🌦', 81: '🌧', 82: '⛈',
  95: '⛈', 96: '⛈', 99: '⛈',
}
