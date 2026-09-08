import nspell from "nspell";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import type { GrammarIssue } from "@retenit/shared";

/**
 * Offline spell checking, on device, with no server and no API key.
 *
 * A Hunspell dictionary compiled into the app: 542 KB of assets and one npm
 * package, against the alternative of running a machine somewhere. It catches
 * spelling only, which is the overwhelming majority of what anyone actually
 * fixes in a draft.
 *
 * Android's keyboard already underlines misspellings, but that underline
 * belongs to the keyboard: it cannot be tapped for our own tooltip, does not
 * exist when a hardware keyboard is attached, and disappears entirely once text
 * is not focused. This gives the pad its own marks, in our own UI, offline.
 *
 * True grammar (subject-verb agreement, tense) is not possible offline in any
 * reasonable size. That stays behind the optional LanguageTool endpoint.
 */

let speller: ReturnType<typeof nspell> | null = null;
let loading: Promise<void> | null = null;

/**
 * Parse the dictionary once, lazily.
 *
 * Parsing 539 KB of Hunspell takes a noticeable moment on a mid range phone, so
 * it happens the first time checking is switched on rather than at launch, and
 * only once for the life of the process.
 */
async function ensureLoaded(): Promise<void> {
  if (speller) return;
  if (loading) return loading;

  loading = (async () => {
    const [aff, dic] = await Promise.all([
      Asset.fromModule(require("../../../assets/dictionaries/en.aff")).downloadAsync(),
      Asset.fromModule(require("../../../assets/dictionaries/en.dic")).downloadAsync(),
    ]);

    if (!aff.localUri || !dic.localUri) throw new Error("dictionary assets missing");

    const [affText, dicText] = await Promise.all([
      new File(aff.localUri).text(),
      new File(dic.localUri).text(),
    ]);

    speller = nspell(affText, dicText);
  })();

  try {
    await loading;
  } finally {
    loading = null;
  }
}

export const isSpellReady = () => speller !== null;

/**
 * Words, with their offsets.
 *
 * Apostrophes are kept inside a word so "don't" is checked whole rather than as
 * "don" plus a stray "t". Anything containing a digit is skipped: model numbers
 * and years are not misspellings.
 */
const WORD = /[\p{L}][\p{L}'’]*/gu;

/** Below this, false positives outnumber real catches. */
const MIN_LENGTH = 3;

/** A long note is not worth freezing the UI over. */
const MAX_WORDS = 4_000;

export async function findMisspellings(text: string): Promise<GrammarIssue[]> {
  await ensureLoaded();
  if (!speller) return [];

  const issues: GrammarIssue[] = [];
  const seen = new Map<string, string[]>();
  let count = 0;

  for (const match of text.matchAll(WORD)) {
    if (++count > MAX_WORDS) break;

    const word = match[0];
    const offset = match.index ?? 0;

    if (word.length < MIN_LENGTH) continue;
    // Acronyms and initialisms are not in any dictionary and are rarely typos.
    if (word === word.toUpperCase()) continue;

    // Normalise the typographic apostrophe the keyboard inserts, which the
    // dictionary does not contain.
    const normalised = word.replace(/’/g, "'");
    if (speller.correct(normalised)) continue;

    // Suggestions are the expensive part, so each distinct word is looked up
    // once however many times it appears.
    let replacements = seen.get(normalised);
    if (!replacements) {
      replacements = speller.suggest(normalised).slice(0, 3);
      seen.set(normalised, replacements);
    }

    issues.push({
      offset,
      length: word.length,
      message: `"${word}" is not in the dictionary.`,
      shortMessage: "Possible spelling mistake",
      replacements,
      category: "spelling",
    });
  }

  return issues;
}
