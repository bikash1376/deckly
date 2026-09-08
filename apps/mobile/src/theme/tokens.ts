/**
 * Deckly design tokens — derived from the reference screens in /ref.
 * Muted, editorial, off-white ground. Light mode only for v1: the refs are a
 * light language, and a half-hearted dark mode reads worse than none.
 */

export const palette = {
  // Ground + ink
  bg: "#EDECEA",
  bgSunken: "#E5E4E1",
  surface: "#FFFFFF",
  surfaceAlt: "#F6F5F3",
  ink: "#111111",
  inkMuted: "#6B6B6B",
  inkFaint: "#9C9A97",
  hairline: "#DEDCD8",

  // Deck colours (s3 grid). Each has a tint for chips/quiet fills.
  clay: "#935B5D",
  clayTint: "#F0E5E5",
  slate: "#71829A",
  slateTint: "#E3E7EC",
  sage: "#8E9379",
  sageTint: "#E8EAE2",
  mocha: "#7E6E68",
  mochaTint: "#EBE6E4",
  eucalyptus: "#6E8781",
  eucalyptusTint: "#E2E9E7",
  plum: "#6B5F7E",
  plumTint: "#E6E3EB",

  // Accents
  amber: "#E8B44A",
  amberTint: "#FAF0DA",
  success: "#5C7A5E",
  danger: "#A85449",
} as const;

export type DeckColorKey =
  | "clay"
  | "slate"
  | "sage"
  | "mocha"
  | "eucalyptus"
  | "plum";

export const deckColor = (key: DeckColorKey) => ({
  base: palette[key],
  tint: palette[`${key}Tint` as const],
});

/** Deterministic colour from a deck id, so a deck keeps its identity offline. */
export const colorForId = (id: string): DeckColorKey => {
  const keys: DeckColorKey[] = ["clay", "slate", "sage", "mocha", "eucalyptus", "plum"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return keys[h % keys.length];
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  /** Screen gutter used everywhere. The refs are generous with margin. */
  gutter: 20,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  tile: 20,
  card: 24,
  sheet: 28,
  pill: 999,
} as const;

/** Soft and low. The refs never use a hard drop shadow. */
export const shadow = {
  card: {
    shadowColor: "#111111",
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  floating: {
    shadowColor: "#111111",
    shadowOpacity: 0.1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  none: {},
} as const;

export const duration = {
  fast: 140,
  base: 220,
  slow: 380,
} as const;
