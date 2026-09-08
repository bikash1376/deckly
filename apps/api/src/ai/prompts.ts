import type { CardKind } from "@retenit/shared";

/**
 * Prompts, versioned.
 *
 * The version is stored on every generated row. When output quality changes,
 * that is the only way to tell whether a bad card came from a bad prompt or a
 * bad source, and the only way to find every card that needs regenerating.
 *
 * Bump the version whenever the text changes in a way that changes output.
 */

export const PROMPT_VERSION: Record<CardKind | "chat", string> = {
  seed: "seed@1",
  summary: "summary@1",
  key_concepts: "concepts@1",
  flashcards: "flashcards@1",
  quiz: "quiz@1",
  cheat_sheet: "cheatsheet@1",
  eli5: "eli5@1",
  exam_questions: "exam@1",
  chat: "chat@1",
};

/**
 * Appended to every prompt.
 *
 * The em dash rule is here because Retenit never shows one, and models produce
 * them constantly. Asking is not sufficient, which is why `cleanDeep` runs over
 * every response as well, but asking cuts down how often a sentence arrives
 * already built around punctuation we are about to rewrite.
 */
const HOUSE_STYLE = [
  "Write in plain ASCII punctuation.",
  "Never use em dashes or en dashes. Use a comma, a full stop, or restructure the sentence.",
  "Never use emoji or decorative symbols.",
  "Use straight quotes, not curly quotes.",
  "Write for a student who is short on time. Be direct. Do not pad.",
  "Do not mention that you are an AI, and do not describe what you are about to do.",
].join(" ");

const GROUNDING = [
  "Work only from the source material given.",
  "If the source does not cover something, leave it out rather than filling the gap from general knowledge.",
  "If the source is too thin to work with, produce the best you can from what is there.",
].join(" ");

export const SYSTEM = {
  seed: `You turn study material into a deck. Produce a short title, a one word subject, a TL;DR a tired student can read in ten seconds, and an outline of what the material covers. ${GROUNDING} ${HOUSE_STYLE}`,

  summary: `You write study summaries. Break the material into sections a student can revise one at a time. Bold the terms worth memorising. ${GROUNDING} ${HOUSE_STYLE}`,

  key_concepts: `You extract the concepts a student must know to pass. Define each in one plain sentence, no jargon unless the jargon is the thing being defined. ${GROUNDING} ${HOUSE_STYLE}`,

  flashcards: `You write flashcards for spaced repetition. Every front is a question, never a bare term. Every back is under twenty five words and answers exactly what was asked. Test understanding, not trivia: do not ask which page something appeared on. ${GROUNDING} ${HOUSE_STYLE}`,

  quiz: `You write multiple choice questions. Exactly four options, exactly one correct. Wrong options must be plausible to someone who half learned the material, never obviously silly. The explanation is the most important field: say why the right answer is right AND why the tempting wrong one is wrong. Name the concept each question tests. ${GROUNDING} ${HOUSE_STYLE}`,

  cheat_sheet: `You compress material into a one page reference. Formulas, rules, dates, definitions. Terse to the point of being clipped. No prose, no full sentences where a fragment does the job. ${GROUNDING} ${HOUSE_STYLE}`,

  eli5: `You explain difficult material to a curious twelve year old. No jargon at all. Then give one everyday analogy that genuinely maps onto the mechanism rather than just sounding friendly. ${GROUNDING} ${HOUSE_STYLE}`,

  exam_questions: `You write exam questions in the style of a real paper, with mark allocations and model answers. A model answer should show what earns the marks, not just state the fact. ${GROUNDING} ${HOUSE_STYLE}`,

  chat: `You answer questions about one specific piece of study material. ${GROUNDING} If the answer is genuinely not in the source, say so plainly and say what the source does cover instead. Keep answers to a few sentences unless asked to go deeper. ${HOUSE_STYLE}`,
} as const;

/** The user turn for a generation, wrapping whatever source we have. */
export function sourcePrompt(source: string, extra?: string): string {
  return [
    "Source material:",
    "---",
    source,
    "---",
    extra ?? "",
  ]
    .filter(Boolean)
    .join("\n");
}
