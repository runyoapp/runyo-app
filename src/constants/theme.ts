export const LightTheme = {
  bg: '#F1EEE6',
  bgAlt: '#EBE7DC',
  surface: '#FFFFFF',
  surface2: '#F7F4EC',
  border: '#DEDACA',
  border2: '#E8E4D9',
  text: '#0E1F1A',
  text2: '#2D3F39',
  muted: '#5E6F69',
  faint: '#86968F',
  accent: '#00B98E',
  accentDim: '#009977',
  accentGlow: 'rgba(0,185,142,0.10)',
  accentInk: '#062019',
} as const

export const DarkTheme = {
  bg: '#0B1714',
  bgAlt: '#111E1A',
  surface: '#152521',
  surface2: '#1A2E28',
  border: '#243530',
  border2: '#1E2D28',
  text: '#EAEFEC',
  text2: '#C5D0CC',
  muted: '#7A9089',
  faint: '#4E6560',
  accent: '#3DDFB1',
  accentDim: '#2EC49D',
  accentGlow: 'rgba(61,223,177,0.10)',
  accentInk: '#062019',
} as const

export type Theme = typeof LightTheme

export const ActivityColors = {
  run:      { text: '#00B98E', bg: 'rgba(0,185,142,0.12)' },
  strength: { text: '#D2632B', bg: 'rgba(210,99,43,0.12)' },
  mobility: { text: '#B5912B', bg: 'rgba(181,145,43,0.12)' },
  rest:     { text: '#86968F', bg: 'rgba(134,150,143,0.12)' },
  race:     { text: '#C8336B', bg: 'rgba(200,51,107,0.12)' },
  recovery: { text: '#7A8A85', bg: 'rgba(122,138,133,0.12)' },
  work:     { text: '#7A8A85', bg: 'rgba(122,138,133,0.12)' },
  swim:     { text: '#1565C0', bg: 'rgba(21,101,192,0.12)' },
  bike:     { text: '#FF6F00', bg: 'rgba(255,111,0,0.12)' },
  gym:      { text: '#5D4037', bg: 'rgba(93,64,55,0.12)' },
} as const

export const Fonts = {
  display: 'Sora',
  displayMedium: 'Sora-Medium',
  displaySemiBold: 'Sora-SemiBold',
  displayBold: 'Sora-Bold',
  mono: 'JetBrainsMono',
  monoMedium: 'JetBrainsMono-Medium',
} as const

export const Radius = {
  sm: 8,
  md: 10,
  lg: 12,
  pill: 999,
} as const

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const
