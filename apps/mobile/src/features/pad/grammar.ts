import { useEffect, useRef, useState } from "react";
import { GrammarIssue } from "@retenit/shared";
import { env } from "@/lib/env";
import { findMisspellings } from "./spell";

/**
 * Grammar checking, off the AI path entirely.
 *
 * Running a language model over every keystroke would be absurd: it is slow,
 * it costs a credit per pass, and it would burn the Groq rate limit in a
 * minute of typing. Grammar is a solved problem with a deterministic tool, so
 * this speaks the LanguageTool HTTP protocol instead.
 *
 * Two layers, and the useful one needs no setup:
 *
 *   Spelling  runs on device against a bundled Hunspell dictionary. Always
 *             available, offline, free, no configuration.
 *   Grammar   needs a LanguageTool endpoint, and only runs if one is set.
 *
 * It deliberately does NOT point at LanguageTool's free public endpoint by
 * default. Their terms say not to send automated requests and to self-host or
 * buy an Enterprise plan for exactly this use, so shipping against it would be
 * a violation. Without a URL the checker still catches spelling, which is the
 * overwhelming majority of what anyone actually fixes.
 */

const CATEGORY: Record<string, GrammarIssue["category"]> = {
  TYPOS: "spelling",
  GRAMMAR: "grammar",
  PUNCTUATION: "punctuation",
  TYPOGRAPHY: "punctuation",
  STYLE: "style",
  REDUNDANCY: "style",
  CASING: "grammar",
  CONFUSED_WORDS: "grammar",
  COLLOCATIONS: "grammar",
};

/** LanguageTool caps a single request at 20KB, so stay comfortably under it. */
const MAX_CHARS = 15_000;

/** Long enough that it fires between sentences, not between letters. */
const DEBOUNCE_MS = 1_200;

/** Whether the optional grammar layer is available on top of spelling. */
export const isGrammarConfigured = () => !!env.grammarApiUrl;

interface LanguageToolMatch {
  offset: number;
  length: number;
  message: string;
  shortMessage?: string;
  replacements?: { value: string }[];
  rule?: { category?: { id?: string } };
}

async function check(text: string, signal: AbortSignal): Promise<GrammarIssue[]> {
  if (!env.grammarApiUrl) return [];

  const body = new URLSearchParams({
    text: text.slice(0, MAX_CHARS),
    language: "en-US",
    // Picky mode adds style nits that read as nagging on a student's draft.
    level: "default",
  });

  const response = await fetch(`${env.grammarApiUrl.replace(/\/$/, "")}/v2/check`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal,
  });

  if (!response.ok) throw new Error(`grammar check failed: ${response.status}`);

  const payload = (await response.json()) as { matches?: LanguageToolMatch[] };

  return (payload.matches ?? []).map((match) => ({
    offset: match.offset,
    length: match.length,
    message: match.message,
    shortMessage: match.shortMessage || null,
    // Three is as many as fits a tooltip without it becoming a menu.
    replacements: (match.replacements ?? []).slice(0, 3).map((r) => r.value),
    category: CATEGORY[match.rule?.category?.id ?? ""] ?? "other",
  }));
}

export interface UseGrammarResult {
  issues: GrammarIssue[];
  checking: boolean;
  /** Set when the checker is unreachable, so the UI can say so once. */
  error: string | null;
}

/**
 * Debounced checking of the whole note.
 *
 * Re-checks the entire text rather than the edited region, because a grammar
 * rule can span a sentence: fixing a verb three words back changes whether the
 * clause after it is wrong. Partial checking would leave stale underlines.
 */
export function useGrammar(text: string, enabled: boolean): UseGrammarResult {
  const [issues, setIssues] = useState<GrammarIssue[]>([]);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    // Spelling works with no configuration, so the only gate is the toggle.
    if (!enabled || text.trim().length < 12) {
      setIssues([]);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      controller.current?.abort();
      const next = new AbortController();
      controller.current = next;

      setChecking(true);
      try {
        // Spelling first, and independently: it is local and cannot fail for
        // network reasons, so a missing or unreachable grammar server must
        // never take the working half down with it.
        const spelling = await findMisspellings(text).catch(() => []);

        let grammar: GrammarIssue[] = [];
        let reachable = true;
        if (env.grammarApiUrl) {
          try {
            grammar = await check(text, next.signal);
          } catch (caught) {
            if ((caught as Error)?.name === "AbortError") return;
            reachable = false;
          }
        }

        // Grammar wins where the two overlap: "their" flagged as a confused
        // word is more useful than the same span flagged as unknown.
        const claimed = new Set<number>();
        for (const issue of grammar) {
          for (let i = issue.offset; i < issue.offset + issue.length; i++) claimed.add(i);
        }
        const merged = [
          ...grammar,
          ...spelling.filter((issue) => !claimed.has(issue.offset)),
        ].sort((a, b) => a.offset - b.offset);

        setIssues(merged);
        setError(reachable ? null : "Grammar server unreachable. Spelling still checked.");
      } finally {
        setChecking(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [text, enabled]);

  useEffect(() => () => controller.current?.abort(), []);

  return { issues, checking, error };
}

/**
 * Split text into runs, each either clean or carrying one issue.
 *
 * The editor renders these as nested Text elements so an underline sits under
 * exactly the offending characters. Overlapping matches are dropped rather than
 * nested: two underlines on the same word cannot both be tapped.
 */
export interface Segment {
  text: string;
  issue: GrammarIssue | null;
}

export function segment(text: string, issues: GrammarIssue[]): Segment[] {
  if (issues.length === 0) return [{ text, issue: null }];

  const ordered = [...issues].sort((a, b) => a.offset - b.offset);
  const segments: Segment[] = [];
  let cursor = 0;

  for (const issue of ordered) {
    if (issue.offset < cursor) continue;
    if (issue.offset > text.length) break;

    if (issue.offset > cursor) {
      segments.push({ text: text.slice(cursor, issue.offset), issue: null });
    }
    const end = Math.min(issue.offset + issue.length, text.length);
    segments.push({ text: text.slice(issue.offset, end), issue });
    cursor = end;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), issue: null });
  return segments;
}

/** Apply a replacement, returning the new text. Offsets shift, so callers re-check. */
export function applyReplacement(
  text: string,
  issue: GrammarIssue,
  replacement: string,
): string {
  return text.slice(0, issue.offset) + replacement + text.slice(issue.offset + issue.length);
}
