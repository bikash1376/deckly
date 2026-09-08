/**
 * Copy rules for anything a user reads.
 *
 * Deckly never shows em dashes, en dashes or emoji. That applies to hand written
 * UI strings AND to model output, which is the harder half: models produce em
 * dashes constantly and routinely ignore a prompt telling them not to. So the
 * prompt asks, and this sanitiser enforces. Run every generated string through
 * `cleanCopy` before it is stored or rendered.
 */

/** Em dash, en dash, horizontal bar, figure dash, minus sign. */
const DASHES = /[‒–—―−]/g;

/** Smart quotes and ellipsis, normalised to plain ASCII while we are here. */
const SMART_QUOTES = /[‘’‚‛]/g;
const SMART_DQUOTES = /[“”„‟]/g;
const ELLIPSIS = /…/g;

/**
 * Emoji and pictographs. Covers the Emoji_Presentation and Extended_Pictographic
 * properties plus the joiners, variation selectors and skin tone modifiers that
 * hold sequences together, so a family emoji does not decompose into fragments.
 */
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}\u{20E3}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;

/**
 * Replace a dash with the punctuation the sentence actually wanted.
 *
 * A spaced dash is doing the job of a comma or a full stop, so it becomes a
 * comma. An unspaced dash is joining a range or a compound, so it becomes a
 * hyphen. This is a heuristic, not grammar, and it is deliberately conservative:
 * a stray comma reads fine, a stray hyphen inside a sentence does not.
 */
function replaceDashes(input: string): string {
  return input
    .replace(/\s+[‒–—―−]\s+/g, ", ")
    .replace(DASHES, "-");
}

export interface CleanCopyOptions {
  /** Strip emoji. Default true. */
  emoji?: boolean;
  /** Normalise smart quotes and ellipsis to ASCII. Default true. */
  punctuation?: boolean;
}

/**
 * Make a string safe to show. Idempotent, so it is safe to run twice, and safe
 * on text that was already clean.
 */
export function cleanCopy(input: string, options: CleanCopyOptions = {}): string {
  const { emoji = true, punctuation = true } = options;

  let out = replaceDashes(input);

  if (punctuation) {
    out = out
      .replace(SMART_QUOTES, "'")
      .replace(SMART_DQUOTES, '"')
      .replace(ELLIPSIS, "...");
  }

  if (emoji) {
    out = out.replace(EMOJI, "");
  }

  // Collapse whatever whitespace the removals left behind, without touching
  // newlines: markdown output depends on them.
  return out
    .replace(/[^\S\r\n]{2,}/g, " ")
    .replace(/[^\S\r\n]+([,.;:!?])/g, "$1")
    .trim();
}

/**
 * Walk a parsed AI response and clean every string in it, at any depth.
 * Structure, keys and non string values are left alone.
 */
export function cleanDeep<T>(value: T): T {
  if (typeof value === "string") return cleanCopy(value) as unknown as T;
  if (Array.isArray(value)) return value.map(cleanDeep) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = cleanDeep(v);
    return out as T;
  }
  return value;
}

/**
 * Appended to every generation prompt. The sanitiser is the real guarantee,
 * but asking first means fewer sentences arrive with their punctuation already
 * mangled into a comma.
 */
export const COPY_RULES_PROMPT = [
  "Write in plain ASCII punctuation.",
  "Never use em dashes or en dashes. Use a comma, a full stop, or restructure the sentence.",
  "Never use emoji or decorative symbols.",
  "Use straight quotes, not curly quotes.",
].join(" ");
