export const LightTheme = {
  bg:         '#F1EEE6',   // warm paper
  bgAlt:      '#EBE7DC',
  surface:    '#FFFFFF',
  surface2:   '#F7F4EC',
  border:     '#DEDACA',   // --line
  border2:    '#E8E4D9',
  text:       '#0E1F1A',   // --ink (deep forest)
  text2:      '#2D3F39',   // --ink-2
  muted:      '#5E6F69',   // --mute
  faint:      '#86968F',
  accent:     '#00B98E',   // mint
  accentDim:  '#009977',
  accentGlow: 'rgba(0,185,142,0.10)',
  accentInk:  '#062019',
  danger:     '#C8336B',
  dangerBg:   'rgba(200,51,107,0.08)',
} as const

export const DarkTheme = {
  bg:         '#0B1714',
  bgAlt:      '#0E1B18',
  surface:    '#152521',
  surface2:   '#1B2D28',
  border:     '#1F302B',   // --line dark (canonical from brand.md)
  border2:    '#1E2D28',
  text:       '#EAEFEC',
  text2:      '#B7C4BD',
  muted:      '#86968F',
  faint:      '#4E6560',
  accent:     '#3DDFB1',
  accentDim:  '#2EC49D',
  accentGlow: 'rgba(61,223,177,0.10)',
  accentInk:  '#062019',
  danger:     '#FF6B5A',
  dangerBg:   'rgba(255,107,90,0.08)',
} as const

export type Theme = { readonly [K in keyof typeof LightTheme]: string }

export const ActivityColors = {
  run:      { text: '#00B98E', bg: 'rgba(0,185,142,0.12)' },
  strength: { text: '#D2632B', bg: 'rgba(210,99,43,0.12)' },
  mobility: { text: '#B5912B', bg: 'rgba(181,145,43,0.12)' },
  rest:     { text: '#86968F', bg: 'rgba(134,150,143,0.12)' },
  race:     { text: '#C8336B', bg: 'rgba(200,51,107,0.12)' },
  recovery: { text: '#7A8A85', bg: 'rgba(122,138,133,0.12)' },
  work:     { text: '#7A8A85', bg: 'rgba(122,138,133,0.12)' },
  swim:     { text: '#1E8FD6', bg: 'rgba(30,143,214,0.12)' },
  bike:     { text: '#D6B11E', bg: 'rgba(214,177,30,0.12)' },
  gym:      { text: '#8E5BD6', bg: 'rgba(142,91,214,0.12)' },
} as const

// Kleurenpalet voor schema-stippen. Een schema krijgt een vaste kleur (opgeslagen),
// of valt terug op een paletkleur op volgorde van de schemalijst.
export const SchemaPalette = [
  '#00B98E', // mint
  '#1E8FD6', // blauw
  '#8E5BD6', // paars
  '#D2632B', // oranje
  '#C8336B', // magenta
  '#B5912B', // goud
  '#2A9D6E', // groen
  '#D6491E', // rood-oranje
] as const

// De kleur voor de stip van een schema: opgeslagen kleur, anders een deterministische
// paletkleur op basis van de positie in de (gesorteerde) schemalijst.
export function schemaColor(
  schema: { id: string; color: string | null },
  schemaList: { id: string }[],
): string {
  if (schema.color) return schema.color
  const idx = schemaList.findIndex(s => s.id === schema.id)
  return SchemaPalette[(idx < 0 ? 0 : idx) % SchemaPalette.length]
}

// Kiest de eerste paletkleur die nog niet (effectief) door een ander niet-gearchiveerd
// schema gebruikt wordt — voor het automatisch toekennen van een kleurlabel zodra een
// schema op 'weergeven' gaat. Valt terug op de eerste paletkleur als alles bezet is.
export function pickUnusedSchemaColor(
  schemaList: { id: string; color: string | null; isArchived?: boolean }[],
  excludeId: string,
): string {
  const used = new Set(
    schemaList
      .filter(s => s.id !== excludeId && !s.isArchived)
      .map(s => schemaColor(s, schemaList)),
  )
  return SchemaPalette.find(c => !used.has(c)) ?? SchemaPalette[0]
}

export const Fonts = {
  display:        'Sora',
  displayMedium:  'Sora-Medium',
  displaySemiBold:'Sora-SemiBold',
  displayBold:    'Sora-Bold',
  mono:           'JetBrainsMono',
  monoMedium:     'JetBrainsMono-Medium',
} as const

export const Radius = {
  sm:   8,
  md:   10,
  lg:   12,
  pill: 999,
} as const

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
} as const

// Glass tab bar — canonical dark glass from brand.md
export const GlassBg = {
  light: 'rgba(14, 31, 26, 0.88)',
  dark:  'rgba(21, 37, 33, 0.88)',
} as const
