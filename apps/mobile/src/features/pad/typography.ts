import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Reading and writing preferences for the pad.
 *
 * These apply to the note body only. The rest of the app stays on the design
 * system: a student wanting to draft in a handwriting face at 20pt is a writing
 * preference, not a licence to restyle the product.
 *
 * Every family ships exactly two weights, regular and bold. React Native does
 * not synthesise weights for a custom face, so each one is a separate ttf in
 * the APK, and offering four weights across six families would add several
 * megabytes to serve a control almost nobody touches twice.
 */

export const FONT_FAMILIES = [
  {
    id: "default",
    label: "Default",
    note: "Inter",
    regular: "Inter_400Regular",
    bold: "Inter_600SemiBold",
    group: "Sans",
  },
  {
    id: "geist",
    label: "Geist",
    note: "Sans",
    regular: "Geist_400Regular",
    bold: "Geist_600SemiBold",
    group: "Sans",
  },
  {
    id: "newsreader",
    label: "Newsreader",
    note: "Serif",
    regular: "Newsreader_400Regular",
    bold: "Newsreader_600SemiBold",
    group: "Serif",
  },
  {
    id: "literata",
    label: "Literata",
    note: "Serif, built for long reading",
    regular: "Literata_400Regular",
    bold: "Literata_600SemiBold",
    group: "Serif",
  },
  {
    id: "caveat",
    label: "Caveat",
    note: "Handwriting",
    regular: "Caveat_400Regular",
    bold: "Caveat_700Bold",
    group: "Handwriting",
  },
  {
    id: "unkempt",
    label: "Unkempt",
    note: "Handwriting",
    regular: "Unkempt_400Regular",
    bold: "Unkempt_700Bold",
    group: "Handwriting",
  },
] as const;

export type FontFamilyId = (typeof FONT_FAMILIES)[number]["id"];

/**
 * Discrete steps rather than a free slider.
 *
 * A slider invites fiddling and lands people on 16.4pt with awkward leading.
 * Five sizes covers everyone and every one of them is a size we have checked.
 */
export const FONT_SIZES = [15, 17, 19, 21, 24] as const;
export const LINE_HEIGHTS = [
  { id: "tight", label: "Tight", multiplier: 1.35 },
  { id: "normal", label: "Normal", multiplier: 1.55 },
  { id: "relaxed", label: "Relaxed", multiplier: 1.8 },
] as const;
export const TRACKING = [
  { id: "tight", label: "Tight", value: -0.4 },
  { id: "normal", label: "Normal", value: 0 },
  { id: "wide", label: "Wide", value: 0.5 },
] as const;

export type LineHeightId = (typeof LINE_HEIGHTS)[number]["id"];
export type TrackingId = (typeof TRACKING)[number]["id"];

interface TypographyState {
  family: FontFamilyId;
  size: number;
  bold: boolean;
  lineHeight: LineHeightId;
  tracking: TrackingId;
  /**
   * Off by default and deliberately so. Squiggly underlines on someone's first
   * paragraph read as criticism before they have asked for any.
   */
  grammarEnabled: boolean;

  setFamily: (family: FontFamilyId) => void;
  setSize: (size: number) => void;
  setBold: (bold: boolean) => void;
  setLineHeight: (id: LineHeightId) => void;
  setTracking: (id: TrackingId) => void;
  setGrammarEnabled: (enabled: boolean) => void;
  reset: () => void;
}

const DEFAULTS = {
  family: "default" as FontFamilyId,
  size: 17,
  bold: false,
  lineHeight: "normal" as LineHeightId,
  tracking: "normal" as TrackingId,
  grammarEnabled: false,
};

export const useTypography = create<TypographyState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setFamily: (family) => set({ family }),
      setSize: (size) => set({ size }),
      setBold: (bold) => set({ bold }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setTracking: (tracking) => set({ tracking }),
      setGrammarEnabled: (grammarEnabled) => set({ grammarEnabled }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: "retenit.pad-typography.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Resolved text style for the editor body. */
export function resolveTextStyle(state: {
  family: FontFamilyId;
  size: number;
  bold: boolean;
  lineHeight: LineHeightId;
  tracking: TrackingId;
}) {
  const family = FONT_FAMILIES.find((f) => f.id === state.family) ?? FONT_FAMILIES[0];
  const leading = LINE_HEIGHTS.find((l) => l.id === state.lineHeight) ?? LINE_HEIGHTS[1];
  const track = TRACKING.find((t) => t.id === state.tracking) ?? TRACKING[1];

  return {
    fontFamily: state.bold ? family.bold : family.regular,
    fontSize: state.size,
    lineHeight: Math.round(state.size * leading.multiplier),
    letterSpacing: track.value,
  };
}
