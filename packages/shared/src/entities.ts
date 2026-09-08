import { z } from "zod";
import { CardKind, DeckColor, SourceKind, Entitlement } from "./domain";

/**
 * Wire shapes. These are what the Worker returns and what the app parses, so
 * they are the actual contract between the two halves of the product.
 * Timestamps are ISO strings, never Date: JSON has no date type and a silent
 * string-that-looks-like-a-Date is a bug waiting to happen.
 */

export const Deck = z.object({
  id: z.string().uuid(),
  title: z.string(),
  subject: z.string(),
  color: DeckColor,
  sourceKind: SourceKind,
  tldr: z.string(),
  estimatedMinutes: z.number().int(),
  /** Flashcards reviewed at least once, over total flashcards. */
  cardsDone: z.number().int(),
  cardsTotal: z.number().int(),
  createdAt: z.string(),
});
export type Deck = z.infer<typeof Deck>;

export const Card = z.object({
  id: z.string().uuid(),
  deckId: z.string().uuid(),
  kind: CardKind,
  /** Validated against the matching schema in ai-schemas.ts before storage. */
  content: z.unknown(),
  promptVersion: z.string(),
  createdAt: z.string(),
});
export type Card = z.infer<typeof Card>;

export const DeckDetail = z.object({
  deck: Deck,
  cards: z.array(Card),
  outline: z.array(z.object({ heading: z.string(), points: z.array(z.string()) })),
});
export type DeckDetail = z.infer<typeof DeckDetail>;

export const Note = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  updatedAt: z.string(),
  createdAt: z.string(),
});
export type Note = z.infer<typeof Note>;

/** A flashcard as it appears in a review session, with its scheduling state. */
export const ReviewCard = z.object({
  id: z.string().uuid(),
  deckId: z.string().uuid(),
  deckTitle: z.string(),
  deckColor: DeckColor,
  front: z.string(),
  back: z.string(),
  hint: z.string().nullable(),
  dueAt: z.string(),
  lapses: z.number().int(),
});
export type ReviewCard = z.infer<typeof ReviewCard>;

export const ReviewQueue = z.object({
  count: z.number().int(),
  cards: z.array(ReviewCard),
  /** Consecutive days with at least one review completed. */
  streak: z.number().int(),
});
export type ReviewQueue = z.infer<typeof ReviewQueue>;

export const Me = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string().nullable(),
  entitlement: Entitlement,
  streak: z.number().int(),
  decksCreated: z.number().int(),
  cardsReviewed: z.number().int(),
});
export type Me = z.infer<typeof Me>;

/** Signed direct-to-R2 upload, so PDFs never pass through the Worker body. */
export const UploadTarget = z.object({
  uploadUrl: z.string(),
  key: z.string(),
  expiresIn: z.number().int(),
});
export type UploadTarget = z.infer<typeof UploadTarget>;

export const WeakTopic = z.object({
  concept: z.string(),
  wrong: z.number().int(),
  total: z.number().int(),
});
export type WeakTopic = z.infer<typeof WeakTopic>;
