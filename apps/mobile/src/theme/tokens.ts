/**
 * Raw token values mirrored from `src/global.css`.
 *
 * Styling goes through Uniwind classNames — this file exists ONLY for the
 * places a className can't reach: SVG fills, StatusBar, navigation theming,
 * Reanimated interpolations. If you're importing this into a `style` prop,
 * you almost certainly want a className instead.
 *
 * Keep in sync with @theme in global.css.
 */

export const DECK_COLORS = [
  "clay",
  "slate",
  "sage",
  "mocha",
  "eucalyptus",
  "plum",
] as const;

export type DeckColorKey = (typeof DECK_COLORS)[number];

export const raw = {
  bg: "#EDECEA",
  bgSunken: "#E5E4E1",
  surface: "#FFFFFF",
  surfaceAlt: "#F6F5F3",
  hairline: "#DEDCD8",
  ink: "#111111",
  inkMuted: "#6B6B6B",
  inkFaint: "#9C9A97",

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

  amber: "#E8B44A",
  success: "#5C7A5E",
  danger: "#A85449",
} as const;

/**
 * Deterministic colour from a deck id — a deck keeps its identity offline,
 * across devices, and without a round-trip.
 */
export function colorForId(id: string): DeckColorKey {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return DECK_COLORS[h % DECK_COLORS.length];
}

/** Tailwind class fragments per deck colour, for building variant maps. */
export const deckClass: Record<
  DeckColorKey,
  { bg: string; tint: string; text: string; border: string }
> = {
  clay: { bg: "bg-clay", tint: "bg-clay-tint", text: "text-clay", border: "border-clay" },
  slate: { bg: "bg-slate", tint: "bg-slate-tint", text: "text-slate", border: "border-slate" },
  sage: { bg: "bg-sage", tint: "bg-sage-tint", text: "text-sage", border: "border-sage" },
  mocha: { bg: "bg-mocha", tint: "bg-mocha-tint", text: "text-mocha", border: "border-mocha" },
  eucalyptus: {
    bg: "bg-eucalyptus",
    tint: "bg-eucalyptus-tint",
    text: "text-eucalyptus",
    border: "border-eucalyptus",
  },
  plum: { bg: "bg-plum", tint: "bg-plum-tint", text: "text-plum", border: "border-plum" },
};

/** Soft and low — the refs never use a hard drop shadow. */
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
} as const;

export const duration = { fast: 140, base: 220, slow: 380 } as const;
