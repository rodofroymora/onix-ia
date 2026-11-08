/** Tokens JS espejo de tokens.css para consumo en runtime. */

export const colors = {
  accent: '#6E5BD8',
  accentHover: '#5A48C4',
  bg: '#F7F4EF',
  bgElevated: '#FFFCF7',
  text: '#1C1915',
  textMuted: '#5C564C',
  success: '#2F6B4F',
  warning: '#9A6B1F',
  danger: '#A33B3B',
} as const;

export const darkColors = {
  accent: '#8B7AEF',
  bg: '#16141A',
  bgElevated: '#1E1B24',
  text: '#F3EFE8',
  textMuted: '#B5AEA3',
} as const;

export const themes = ['light', 'dark'] as const;
export type Theme = (typeof themes)[number];
