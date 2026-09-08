import { createGroq } from "@ai-sdk/groq";
import type { Bindings } from "@/env";

/**
 * The model provider.
 *
 * Groq is the launch choice: it is fast enough that a summary feels immediate,
 * and cheap enough that lazy generation stays comfortably profitable.
 *
 * It is reached through a gateway when one is configured, which buys response
 * caching, per key rate limiting and one place to watch spend. Swapping
 * provider later is a change to this file and the two model ids in
 * wrangler.jsonc, not a change to any calling code, which is the whole reason
 * generation goes through `generateObject` with a schema rather than through
 * provider specific response parsing.
 */
export function createModel(env: Bindings, tier: "fast" | "quality" = "fast") {
  const groq = createGroq({
    apiKey: env.GROQ_API_KEY,
    ...(env.CF_AI_GATEWAY_TOKEN
      ? {
          headers: { "cf-aig-authorization": `Bearer ${env.CF_AI_GATEWAY_TOKEN}` },
        }
      : {}),
  });

  return groq(tier === "quality" ? env.MODEL_QUALITY : env.MODEL_FAST);
}

/**
 * How much source text a single generation reads.
 *
 * Well under the model's context window on purpose, for two reasons.
 *
 * Quality: filling a window degrades attention across the middle of it, and a
 * summary built from a truncated but coherent chunk beats one built from
 * everything at half the quality.
 *
 * Budget: 12k characters is roughly 3k tokens. Groq's free tier allows 8k
 * tokens per MINUTE across the whole account, so at the old 24k limit a single
 * deck would consume most of a minute's allowance on input alone.
 */
export const MAX_SOURCE_CHARS = 12_000;

/** Trim to a sentence boundary so the model never starts mid-word. */
export function clampSource(text: string, max = MAX_SOURCE_CHARS): string {
  if (text.length <= max) return text;

  const cut = text.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
  return lastStop > max * 0.6 ? cut.slice(0, lastStop + 1) : cut;
}
