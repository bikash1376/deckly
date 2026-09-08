import { generateObject } from "ai";
import type { z } from "zod";
import {
  DeckSeed,
  Summary,
  KeyConcepts,
  Flashcards,
  Quiz,
  CheatSheet,
  Eli5,
  ExamQuestions,
  GrammarCheck,
  EnhanceResult,
  type CardKind,
} from "@deckly/shared";
import { createModel, clampSource } from "./client";
import { SYSTEM, PROMPT_VERSION, sourcePrompt } from "./prompts";
import { errors } from "@/lib/errors";
import type { Bindings } from "@/env";

/**
 * Every generation goes through `generateObject` with a Zod schema.
 *
 * Never prompt-and-parse. A schema turns "the model wrote prose instead of
 * JSON" from a runtime crash in the app into a caught failure here, where the
 * user's credits can be refunded and they can be told to try again.
 */

const SCHEMA: Record<Exclude<CardKind, "seed">, z.ZodTypeAny> = {
  summary: Summary,
  key_concepts: KeyConcepts,
  flashcards: Flashcards,
  quiz: Quiz,
  cheat_sheet: CheatSheet,
  eli5: Eli5,
  exam_questions: ExamQuestions,
};

/** Quizzes and exam questions get the better model: wrong output is expensive. */
const TIER: Record<Exclude<CardKind, "seed">, "fast" | "quality"> = {
  summary: "fast",
  key_concepts: "fast",
  flashcards: "fast",
  quiz: "quality",
  cheat_sheet: "fast",
  eli5: "fast",
  exam_questions: "quality",
};

async function run<T>(
  env: Bindings,
  tier: "fast" | "quality",
  system: string,
  prompt: string,
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    const { object } = await generateObject({
      model: createModel(env, tier),
      schema,
      system,
      prompt,
      // Low but not zero. Zero makes flashcards for the same source come out
      // word for word identical across regenerations, which reads as broken.
      temperature: 0.4,
      maxRetries: 2,
    });
    return object;
  } catch (caught) {
    // Includes schema validation failures, which is the common case: the model
    // returned JSON that does not fit. That is a generation failure, not a bug
    // the user should see a stack trace for.
    console.error("generation failed", { tier, error: String(caught) });
    throw errors.generationFailed();
  }
}

export async function generateSeed(env: Bindings, source: string) {
  const object = await run(
    env,
    "fast",
    SYSTEM.seed,
    sourcePrompt(clampSource(source)),
    DeckSeed,
  );
  return { object, promptVersion: PROMPT_VERSION.seed, model: env.MODEL_FAST };
}

export async function generateCard(
  env: Bindings,
  kind: Exclude<CardKind, "seed">,
  source: string,
) {
  const tier = TIER[kind];
  const object = await run(
    env,
    tier,
    SYSTEM[kind],
    sourcePrompt(clampSource(source)),
    SCHEMA[kind] as z.ZodType<unknown>,
  );

  return {
    object,
    promptVersion: PROMPT_VERSION[kind],
    model: tier === "quality" ? env.MODEL_QUALITY : env.MODEL_FAST,
  };
}

export async function answerQuestion(env: Bindings, source: string, question: string) {
  const { generateText } = await import("ai");
  try {
    const { text } = await generateText({
      model: createModel(env, "fast"),
      system: SYSTEM.chat,
      prompt: sourcePrompt(clampSource(source), `Question: ${question}`),
      temperature: 0.3,
      maxRetries: 2,
    });
    return text;
  } catch (caught) {
    console.error("chat failed", String(caught));
    throw errors.generationFailed();
  }
}

export async function checkGrammar(env: Bindings, text: string) {
  return run(
    env,
    "fast",
    SYSTEM.grammar,
    `Check this text:\n---\n${clampSource(text, 8_000)}\n---`,
    GrammarCheck,
  );
}

export async function enhanceText(env: Bindings, text: string) {
  return run(
    env,
    "quality",
    SYSTEM.enhance,
    `Rewrite this passage:\n---\n${clampSource(text, 4_000)}\n---`,
    EnhanceResult,
  );
}
