import { z } from "zod";

/**
 * Structured-output schemas for every AI generation.
 * These are the contract between the Worker (generateObject) and the app.
 * Keep them narrow — the tighter the schema, the less the model wanders.
 */

export const OutlineItem = z.object({
  heading: z.string().describe("Short section heading, max 6 words"),
  points: z.array(z.string()).min(1).max(5),
});

/** Generated immediately on deck creation — cheap and fast. */
export const DeckSeed = z.object({
  title: z.string().describe("Deck title, max 5 words, no punctuation"),
  subject: z.string().describe("One-word subject, e.g. Biology, History"),
  tldr: z.string().describe("2-3 sentences a tired student can read in 10 seconds"),
  outline: z.array(OutlineItem).min(3).max(8),
  estimatedMinutes: z.number().int().min(1).max(120),
});
export type DeckSeed = z.infer<typeof DeckSeed>;

export const Summary = z.object({
  sections: z.array(
    z.object({
      heading: z.string(),
      body: z.string().describe("Markdown. Use bold for terms worth memorising."),
    }),
  ),
});
export type Summary = z.infer<typeof Summary>;

export const KeyConcepts = z.object({
  concepts: z.array(
    z.object({
      term: z.string(),
      definition: z.string().describe("One sentence, plain language"),
      // Nullable, not optional: Groq strict mode requires every field to be
      // present, so absence is expressed as null rather than omission.
      whyItMatters: z.string().nullable(),
    }),
  ).min(3).max(20),
});
export type KeyConcepts = z.infer<typeof KeyConcepts>;

export const Flashcards = z.object({
  cards: z.array(
    z.object({
      front: z.string().describe("A question, never a bare term"),
      back: z.string().describe("Answer in under 25 words"),
      hint: z.string().nullable(),
    }),
  ).min(5).max(40),
});
export type Flashcards = z.infer<typeof Flashcards>;

export const Quiz = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()).length(4),
      correctIndex: z.number().int().min(0).max(3),
      /** Shown after answering — this is the whole value of the quiz. */
      explanation: z.string(),
      concept: z.string().describe("Which key concept this tests, for weak-topic tracking"),
    }),
  ).min(3).max(20),
});
export type Quiz = z.infer<typeof Quiz>;

export const CheatSheet = z.object({
  groups: z.array(
    z.object({
      label: z.string(),
      lines: z.array(z.string()).describe("Terse. Formula, rule, or date — not prose."),
    }),
  ),
});
export type CheatSheet = z.infer<typeof CheatSheet>;

export const Eli5 = z.object({
  explanation: z.string().describe("Explain to a curious 12-year-old. No jargon."),
  analogy: z.string().describe("One everyday analogy"),
});
export type Eli5 = z.infer<typeof Eli5>;

export const ExamQuestions = z.object({
  questions: z.array(
    z.object({
      prompt: z.string(),
      marks: z.number().int().min(1).max(20),
      modelAnswer: z.string(),
    }),
  ).min(3).max(10),
});
export type ExamQuestions = z.infer<typeof ExamQuestions>;
