import { z } from "zod";

/** The six deck colours from the reference grid. Assigned on create, never edited. */
export const DECK_COLORS = [
  "clay",
  "slate",
  "sage",
  "mocha",
  "eucalyptus",
  "plum",
] as const;
export const DeckColor = z.enum(DECK_COLORS);
export type DeckColor = z.infer<typeof DeckColor>;

/**
 * Every generatable artefact in a deck. `seed` is produced on creation;
 * everything else is generated lazily when the user taps it.
 */
export const CARD_KINDS = [
  "seed",
  "summary",
  "key_concepts",
  "flashcards",
  "quiz",
  "cheat_sheet",
  "eli5",
  "exam_questions",
] as const;
export const CardKind = z.enum(CARD_KINDS);
export type CardKind = z.infer<typeof CardKind>;

/**
 * Credit cost per action. Server is the source of truth — this copy exists so
 * the app can grey out actions before spending a round-trip.
 * Mirrors the `pricing` table; treat as a cache, not law.
 */
export const CREDIT_COST: Record<string, number> = {
  seed: 10,
  summary: 4,
  key_concepts: 3,
  flashcards: 5,
  quiz: 5,
  cheat_sheet: 3,
  eli5: 2,
  exam_questions: 4,
  deck_chat: 1,
};

export const SOURCE_KINDS = ["topic", "text", "pdf"] as const;
export const SourceKind = z.enum(SOURCE_KINDS);
export type SourceKind = z.infer<typeof SourceKind>;

export const CreateDeckInput = z.object({
  sourceKind: SourceKind,
  /** Topic string, pasted text, or the R2 object key for an uploaded PDF. */
  source: z.string().min(2).max(60_000),
  fileName: z.string().optional(),
});
export type CreateDeckInput = z.infer<typeof CreateDeckInput>;

export const GenerateCardInput = z.object({
  deckId: z.string().uuid(),
  kind: CardKind.exclude(["seed"]),
});
export type GenerateCardInput = z.infer<typeof GenerateCardInput>;

/** SM-2 lite grades. Four buttons is the most a tired student will use. */
export const REVIEW_GRADES = ["again", "hard", "good", "easy"] as const;
export const ReviewGrade = z.enum(REVIEW_GRADES);
export type ReviewGrade = z.infer<typeof ReviewGrade>;

export const Entitlement = z.object({
  isPremium: z.boolean(),
  credits: z.number().int(),
  creditsResetAt: z.string().nullable(),
  /** Free-tier allowances, surfaced so the paywall can show real numbers. */
  monthlyAllowance: z.number().int(),
  notesUsed: z.number().int(),
  noteLimit: z.number().int(),
});
export type Entitlement = z.infer<typeof Entitlement>;

/**
 * A deck the user builds themselves, with no model involved.
 *
 * Manual decks cost no credits on purpose. Generation is the paid product;
 * owning a deck is not. Someone out of credits should still be able to type in
 * the ten cards they need tonight, and someone who does not trust AI output for
 * their subject should be able to use the app at all.
 */
export const CreateManualDeckInput = z.object({
  title: z.string().min(1).max(80),
  subject: z.string().min(1).max(40),
});
export type CreateManualDeckInput = z.infer<typeof CreateManualDeckInput>;

/**
 * Hand written cards, with the generation minimums relaxed.
 *
 * The AI schemas floor flashcards at five and quiz questions at three, which is
 * right when a model is producing them: two flashcards from a whole chapter
 * means the generation went wrong. It is exactly wrong for someone typing in
 * the three cards they need tonight, who would just be told "could not save".
 */
export const ManualFlashcards = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().min(1).max(400),
        back: z.string().min(1).max(1000),
        hint: z.string().nullable(),
      }),
    )
    .min(1)
    .max(200),
});
export type ManualFlashcards = z.infer<typeof ManualFlashcards>;

export const ManualQuiz = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1).max(500),
        options: z.array(z.string().min(1).max(300)).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: z.string().min(1).max(1000),
        concept: z.string().min(1).max(200),
      }),
    )
    .min(1)
    .max(100),
});
export type ManualQuiz = z.infer<typeof ManualQuiz>;
