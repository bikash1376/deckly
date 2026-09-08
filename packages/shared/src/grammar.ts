import { z } from "zod";

/**
 * A single writing problem, positioned so it can be underlined in place.
 *
 * Offset and length rather than a copy of the offending text: a squiggly
 * underline has to know exactly which characters to draw under, and searching
 * the document for a substring would underline the wrong "there" whenever the
 * word appears more than once.
 *
 * The shape mirrors LanguageTool's, which is what the checker speaks, so a
 * self-hosted instance can be swapped for any other implementation of the same
 * protocol without the app noticing.
 */
export const GrammarIssue = z.object({
  /** Character offset into the text that was checked. */
  offset: z.number().int().min(0),
  length: z.number().int().min(1),
  /** Shown in the tooltip. */
  message: z.string(),
  /** Terser label for the chip, when the checker provides one. */
  shortMessage: z.string().nullable(),
  /** Ordered best first. Usually one to three are worth showing. */
  replacements: z.array(z.string()),
  category: z.enum(["spelling", "grammar", "punctuation", "style", "other"]),
});
export type GrammarIssue = z.infer<typeof GrammarIssue>;

export const GrammarResult = z.object({
  issues: z.array(GrammarIssue),
});
export type GrammarResult = z.infer<typeof GrammarResult>;
