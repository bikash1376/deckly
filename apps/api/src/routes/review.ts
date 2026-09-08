import { Hono } from "hono";
import { and, eq, lte, sql, count } from "drizzle-orm";
import { ReviewGrade, Flashcards as FlashcardsSchema } from "@deckly/shared";
import { createDb, reviews, decks, cards, reviewDays, users } from "@/db";
import { errors } from "@/lib/errors";
import { schedule, type SrsState } from "@/lib/srs";
import type { AppEnv } from "@/env";

const route = new Hono<AppEnv>();

/** One session's worth. More than this and nobody finishes. */
const QUEUE_LIMIT = 40;

route.get("/count", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db
    .select({ value: count() })
    .from(reviews)
    .where(and(eq(reviews.userId, c.get("userId")), lte(reviews.dueAt, new Date())));

  return c.json({ count: Number(rows[0]?.value ?? 0) });
});

route.get("/due", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");

  const due = await db
    .select({
      id: reviews.id,
      deckId: reviews.deckId,
      cardId: reviews.cardId,
      cardIndex: reviews.cardIndex,
      dueAt: reviews.dueAt,
      lapses: reviews.lapses,
      deckTitle: decks.title,
      deckColor: decks.color,
      content: cards.content,
    })
    .from(reviews)
    .innerJoin(decks, eq(decks.id, reviews.deckId))
    .innerJoin(cards, eq(cards.id, reviews.cardId))
    .where(and(eq(reviews.userId, userId), lte(reviews.dueAt, new Date())))
    .orderBy(reviews.dueAt)
    .limit(QUEUE_LIMIT);

  // The flashcard text lives in one JSON array per deck, so resolve each
  // review's index against its parent card here rather than denormalising the
  // text into every review row.
  const items = due.flatMap((row) => {
    const parsed = FlashcardsSchema.safeParse(row.content);
    const card = parsed.success ? parsed.data.cards[row.cardIndex] : undefined;
    if (!card) return [];

    return [
      {
        id: row.id,
        deckId: row.deckId,
        deckTitle: row.deckTitle,
        deckColor: row.deckColor,
        front: card.front,
        back: card.back,
        hint: card.hint ?? null,
        dueAt: row.dueAt.toISOString(),
        lapses: row.lapses,
      },
    ];
  });

  return c.json({ count: items.length, cards: items, streak: await currentStreak(db, userId) });
});

route.post("/grade", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");

  const body = (await c.req.json().catch(() => null)) as
    | { cardId?: string; cardIndex?: number; grade?: string }
    | null;

  const gradeResult = ReviewGrade.safeParse(body?.grade);
  if (!gradeResult.success || !body?.cardId) {
    throw errors.invalid("That review could not be recorded.");
  }

  // Two callers, two ways of naming the same row. The daily queue already holds
  // review ids, so it sends one directly. A deck's own flashcard session only
  // knows the parent card and a position within it, so it sends both and the
  // row is found through the (card_id, card_index) unique index.
  const locator =
    typeof body.cardIndex === "number"
      ? and(eq(reviews.cardId, body.cardId), eq(reviews.cardIndex, body.cardIndex))
      : eq(reviews.id, body.cardId);

  const rows = await db
    .select()
    .from(reviews)
    .where(and(locator, eq(reviews.userId, userId)))
    .limit(1);

  const current = rows[0];
  if (!current) throw errors.notFound("That card");

  const state: SrsState = {
    ease: current.ease,
    interval: current.interval,
    streak: current.streak,
    lapses: current.lapses,
  };

  const next = schedule(state, gradeResult.data);

  const now = new Date();
  const dueAt = new Date(now.getTime() + next.interval * 24 * 60 * 60 * 1000);

  await db
    .update(reviews)
    .set({
      ease: next.ease,
      interval: next.interval,
      streak: next.streak,
      lapses: next.lapses,
      lastReviewedAt: now,
      dueAt,
    })
    .where(eq(reviews.id, current.id));

  await recordReviewDay(db, userId);

  return c.json({ dueAt: dueAt.toISOString() });
});

/** One row per local day with at least one review. Streaks read off this. */
async function recordReviewDay(db: ReturnType<typeof createDb>, userId: string) {
  const zoneRows = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const day = localDay(zoneRows[0]?.timezone ?? "UTC");

  await db
    .insert(reviewDays)
    .values({ userId, day, count: 1 })
    .onConflictDoUpdate({
      target: [reviewDays.userId, reviewDays.day],
      set: { count: sql`${reviewDays.count} + 1` },
    });
}

/**
 * Consecutive days ending today or yesterday.
 *
 * Yesterday counts so that someone who reviews at 11pm and then at 1am the
 * following night does not lose a streak they clearly kept.
 */
export async function currentStreak(
  db: ReturnType<typeof createDb>,
  userId: string,
): Promise<number> {
  const rows = await db
    .select({ day: reviewDays.day })
    .from(reviewDays)
    .where(eq(reviewDays.userId, userId))
    .orderBy(sql`${reviewDays.day} DESC`)
    .limit(400);

  if (rows.length === 0) return 0;

  const days = new Set(rows.map((r) => r.day));
  const today = new Date();

  let cursor = new Date(today);
  if (!days.has(toDayString(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(toDayString(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(toDayString(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

function localDay(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    // An unknown zone should not stop a review from being recorded.
    return toDayString(new Date());
  }
}

function toDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default route;
