import { useEffect, useRef, useState } from "react";
import { GrammarIssue } from "@retenit/shared";
import { env } from "@/lib/env";

/**
 * Grammar checking, off the AI path entirely.
 *
 * Running a language model over every keystroke would be absurd: it is slow,
 * it costs a credit per pass, and it would burn the Groq rate limit in a
 * minute of typing. Grammar is a solved problem with a deterministic tool, so
 * this speaks the LanguageTool HTTP protocol instead.
 *
 * It deliberately does NOT point at LanguageTool's free public endpoint by
 * default. Their terms say not to send automated requests and to self-host or
 * buy an Enterprise plan for exactly this use, so shipping against it would be
 * a violation. Set EXPO_PUBLIC_GRAMMAR_API_URL to a self-hosted instance and
 * the feature lights up; leave it unset and the toggle stays disabled with an
 * explanation rather than silently failing.
 *
 * Spelling squiggles come free from Android's own keyboard, on device, with no
 * network at all. This adds the grammar half that Android has no API for.
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
    if (!enabled || !isGrammarConfigured() || text.trim().length < 12) {
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
        setIssues(await check(text, next.signal));
        setError(null);
      } catch (caught) {
        if ((caught as Error)?.name === "AbortError") return;
        setIssues([]);
        setError("Could not reach the grammar checker.");
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
