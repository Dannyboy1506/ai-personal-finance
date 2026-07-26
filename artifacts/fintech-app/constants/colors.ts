/**
 * Dark Emerald & Obsidian theme — inspired by Revolut/Wise dark banking aesthetic.
 * This is a dark-only app; both light and dark keys use the same obsidian palette.
 */

const darkTheme = {
  // Core surfaces
  background: '#0D1117',
  elevated: '#161B22',
  card: '#1C2128',
  cardForeground: '#F0F6FC',
  foreground: '#F0F6FC',

  // Primary — Emerald green
  primary: '#10B981',
  primaryForeground: '#0D1117',

  // Secondary
  secondary: '#21262D',
  secondaryForeground: '#F0F6FC',

  // Muted
  muted: '#21262D',
  mutedForeground: '#8B949E',

  // Accent
  accent: '#10B981',
  accentForeground: '#0D1117',

  // Status colors
  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',
  warning: '#F59E0B',

  // Borders / inputs
  border: '#30363D',
  input: '#21262D',

  // Finance-specific
  credit: '#10B981',    // Money In
  debit: '#F87171',     // Standard expense (was #EF4444 — that failed WCAG AA at 15px/600: 4.30:1 vs 4.5:1 required. This clears at 5.85:1)
  riskDebit: '#F59E0B', // Betting/Gambling category — amber

  // Pacing
  onTrack: '#10B981',
  behindPace: '#F59E0B',
  atRisk: '#EF4444',

  // Legacy aliases for scaffold compatibility
  text: '#F0F6FC',
  tint: '#10B981',
};

const colors = {
  light: darkTheme,
  dark: darkTheme,
  radius: 14,
};

export default colors;
