import { Hono } from "hono";
import { and, desc, eq, sql, count } from "drizzle-orm";
import {
  CreateDeckInput,
  CardKind,
  cleanDeep,
  Flashcards as FlashcardsSchema,
  DECK_COLORS,
  type DeckColor,
} from "@retenit/shared";
import { createDb, decks, cards, reviews, quizAttempts } from "@/db";
import { debit, refund } from "@/lib/credits";
import { assertWithinRateLimit } from "@/lib/rate-limit";
import { errors } from "@/lib/errors";
import { generateSeed, generateCard, answerQuestion } from "@/ai/generate";
import { extractPdf } from "@/ai/pdf";
import type { AppEnv } from "@/env";

const route = new Hono<AppEnv>();

const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Deterministic from the id, so app and server always agree on the colour. */
function colorFor(id: string): DeckColor {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return DECK_COLORS[h % DECK_COLORS.length]!;
}

/** Flashcards done over total, for the progress bar on every deck card. */
const progressColumns = {
  cardsTotal: sql<number>`coalesce((
    select count(*) from ${reviews} r where r.deck_id = ${decks.id}
  ), 0)`.as("cards_total"),
  cardsDone: sql<number>`coalesce((
    select count(*) from ${reviews} r
    where r.deck_id = ${decks.id} and r.last_reviewed_at is not null
  ), 0)`.as("cards_done"),
};

route.get("/", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");

  const rows = await db
    .select({
      id: decks.id,
      title: decks.title,
      subject: decks.subject,
      color: decks.color,
      sourceKind: decks.sourceKind,
      tldr: decks.tldr,
      estimatedMinutes: decks.estimatedMinutes,
      createdAt: decks.createdAt,
      ...progressColumns,
    })
    .from(decks)
    .where(eq(decks.userId, userId))
    .orderBy(desc(decks.createdAt))
    .limit(200);

  return c.json(
    rows.map((r) => ({
      ...r,
      cardsTotal: Number(r.cardsTotal),
      cardsDone: Number(r.cardsDone),
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

route.post("/", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");

  const parsed = CreateDeckInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw errors.invalid("That request was not something we could read.");

  const input = parsed.data;
  if (input.sourceKind === "pdf") {
    throw errors.invalid("Send a PDF to /decks/pdf instead.");
  }
  const sourceText = input.source;

  // Debit first, refund on failure. The other order lets a client cancel
  // mid-request and keep the output for free.
  await assertWithinRateLimit(db, userId);
  await debit(db, userId, "seed", { sourceKind: input.sourceKind });

  let seed;
  try {
    seed = await generateSeed(c.env, sourceText);
  } catch (caught) {
    await refund(db, userId, "seed", "generation failed");
    throw caught;
  }

  const clean = cleanDeep(seed.object);
  const id = crypto.randomUUID();

  const inserted = await db
    .insert(decks)
    .values({
      id,
      userId,
      title: clean.title,
      subject: clean.subject,
      color: colorFor(id),
      sourceKind: input.sourceKind,
      sourceRef: "",
      sourceText,
      fileName: input.fileName ?? null,
      tldr: clean.tldr,
      outline: clean.outline,
      estimatedMinutes: clean.estimatedMinutes,
    })
    .returning();

  const deck = inserted[0]!;

  return c.json({
    id: deck.id,
    title: deck.title,
    subject: deck.subject,
    color: deck.color,
    sourceKind: deck.sourceKind,
    tldr: deck.tldr,
    estimatedMinutes: deck.estimatedMinutes,
    cardsDone: 0,
    cardsTotal: 0,
    createdAt: deck.createdAt.toISOString(),
  });
});

/**
 * Create a deck from a PDF.
 *
 * The file arrives as the raw request body and is never stored. Text is
 * extracted, the deck is built from it, and the bytes are discarded when the
 * request ends. There is no object storage in this system at all: keeping a
 * student's coursework indefinitely is a liability with no product benefit,
 * since the deck is the artefact and the PDF is only how it got here.
 *
 * A separate route from POST /decks because the body is binary, not JSON.
 */
route.post("/pdf", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");

  const fileName = c.req.header("X-File-Name") ?? null;

  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0) throw errors.invalid("That file was empty.");
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw errors.invalid("That PDF is over 20 MB. Try a shorter section.");
  }

  // Check the magic number rather than trusting a header the client set.
  const header = new Uint8Array(bytes.slice(0, 5));
  if (!(header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46)) {
    throw errors.invalid("That file is not a PDF.");
  }

  // Extract BEFORE spending anything. A PDF that turns out to be a scan, or is
  // password protected, should cost the user nothing.
  const extracted = await extractPdf(bytes);

  await assertWithinRateLimit(db, userId);
  await debit(db, userId, "seed", { sourceKind: "pdf", pages: extracted.pages });

  let seed;
  try {
    seed = await generateSeed(c.env, extracted.text);
  } catch (caught) {
    await refund(db, userId, "seed", "generation failed");
    throw caught;
  }

  const clean = cleanDeep(seed.object);
  const id = crypto.randomUUID();

  const inserted = await db
    .insert(decks)
    .values({
      id,
      userId,
      title: clean.title,
      subject: clean.subject,
      color: colorFor(id),
      sourceKind: "pdf",
      sourceRef: "",
      // The extracted text is kept so regenerating a card later does not need
      // the original file, which by then is long gone.
      sourceText: extracted.text,
      fileName,
      tldr: clean.tldr,
      outline: clean.outline,
      estimatedMinutes: clean.estimatedMinutes,
    })
    .returning();

  const deck = inserted[0]!;

  return c.json({
    id: deck.id,
    title: deck.title,
    subject: deck.subject,
    color: deck.color,
    sourceKind: deck.sourceKind,
    tldr: deck.tldr,
    estimatedMinutes: deck.estimatedMinutes,
    cardsDone: 0,
    cardsTotal: 0,
    createdAt: deck.createdAt.toISOString(),
  });
});

route.get("/:id", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");
  const id = c.req.param("id");

  const rows = await db
    .select({
      id: decks.id,
      title: decks.title,
      subject: decks.subject,
      color: decks.color,
      sourceKind: decks.sourceKind,
      tldr: decks.tldr,
      outline: decks.outline,
      estimatedMinutes: decks.estimatedMinutes,
      createdAt: decks.createdAt,
      ...progressColumns,
    })
    .from(decks)
    // Scoped on userId as well as id: an id alone is a guessable handle.
    .where(and(eq(decks.id, id), eq(decks.userId, userId)))
    .limit(1);

  const deck = rows[0];
  if (!deck) throw errors.notFound("That deck");

  const deckCards = await db
    .select()
    .from(cards)
    .where(eq(cards.deckId, id))
    .orderBy(cards.createdAt);

  return c.json({
    deck: {
      ...deck,
      cardsTotal: Number(deck.cardsTotal),
      cardsDone: Number(deck.cardsDone),
      createdAt: deck.createdAt.toISOString(),
    },
    cards: deckCards.map((card) => ({
      id: card.id,
      deckId: card.deckId,
      kind: card.kind,
      content: card.content,
      promptVersion: card.promptVersion,
      createdAt: card.createdAt.toISOString(),
    })),
    outline: deck.outline,
  });
});

route.post("/:id/cards", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");
  const deckId = c.req.param("id");

  const body = (await c.req.json().catch(() => null)) as { kind?: string } | null;
  const kindResult = CardKind.exclude(["seed"]).safeParse(body?.kind);
  if (!kindResult.success) throw errors.invalid("That is not something we can generate.");
  const kind = kindResult.data;

  const deckRows = await db
    .select({ id: decks.id, sourceText: decks.sourceText, tldr: decks.tldr })
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .limit(1);

  const deck = deckRows[0];
  if (!deck) throw errors.notFound("That deck");

  // Already generated. Return it rather than charging twice for the same thing.
  const existing = await db
    .select()
    .from(cards)
    .where(and(eq(cards.deckId, deckId), eq(cards.kind, kind)))
    .limit(1);

  if (existing[0]) {
    return c.json({
      id: existing[0].id,
      deckId,
      kind,
      content: existing[0].content,
      promptVersion: existing[0].promptVersion,
      createdAt: existing[0].createdAt.toISOString(),
    });
  }

  await assertWithinRateLimit(db, userId);
  await debit(db, userId, kind, { deckId });

  let generated;
  try {
    generated = await generateCard(c.env, kind, deck.sourceText ?? deck.tldr);
  } catch (caught) {
    await refund(db, userId, kind, "generation failed");
    throw caught;
  }

  const content = cleanDeep(generated.object);
  const cardId = crypto.randomUUID();

  await db.insert(cards).values({
    id: cardId,
    deckId,
    userId,
    kind,
    content: content as object,
    model: generated.model,
    promptVersion: generated.promptVersion,
  });

  // Flashcards get a scheduling row each, which is what makes them show up in
  // the daily review queue rather than only inside this deck.
  if (kind === "flashcards") {
    const parsed = FlashcardsSchema.safeParse(content);
    if (parsed.success) {
      await db.insert(reviews).values(
        parsed.data.cards.map((_, index) => ({
          userId,
          deckId,
          cardId,
          cardIndex: index,
          dueAt: new Date(),
        })),
      );
    }
  }

  return c.json({
    id: cardId,
    deckId,
    kind,
    content,
    promptVersion: generated.promptVersion,
    createdAt: new Date().toISOString(),
  });
});

route.post("/:id/chat", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");
  const deckId = c.req.param("id");

  const body = (await c.req.json().catch(() => null)) as { message?: string } | null;
  const question = body?.message?.trim();
  if (!question || question.length > 2_000) {
    throw errors.invalid("Ask a question between one and two thousand characters.");
  }

  const rows = await db
    .select({ sourceText: decks.sourceText, tldr: decks.tldr })
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .limit(1);

  const deck = rows[0];
  if (!deck) throw errors.notFound("That deck");

  await assertWithinRateLimit(db, userId);
  await debit(db, userId, "deck_chat", { deckId });

  let reply: string;
  try {
    reply = await answerQuestion(c.env, deck.sourceText ?? deck.tldr, question);
  } catch (caught) {
    await refund(db, userId, "deck_chat", "generation failed");
    throw caught;
  }

  return c.json(cleanDeep({ reply }));
});

/**
 * Record how a quiz went, one row per question.
 *
 * Submitted as a batch when the quiz finishes rather than per answer. A quiz is
 * eight questions; eight round trips to write eight tiny rows would be slower
 * for the user and no more durable, since abandoning halfway means the attempt
 * did not really happen.
 */
route.post("/:id/attempts", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");
  const deckId = c.req.param("id");

  const body = (await c.req.json().catch(() => null)) as
    | { attempts?: { concept?: string; correct?: boolean }[] }
    | null;

  const attempts = (body?.attempts ?? []).filter(
    (a): a is { concept: string; correct: boolean } =>
      typeof a.concept === "string" && a.concept.length > 0 && typeof a.correct === "boolean",
  );

  if (attempts.length === 0) return c.json({ recorded: 0 });
  if (attempts.length > 50) throw errors.invalid("That is more answers than a quiz has.");

  const owned = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .limit(1);

  if (!owned[0]) throw errors.notFound("That deck");

  await db.insert(quizAttempts).values(
    attempts.map((a) => ({
      userId,
      deckId,
      concept: a.concept.slice(0, 200),
      correct: a.correct,
    })),
  );

  return c.json({ recorded: attempts.length });
});

/**
 * Concepts this user keeps getting wrong, worst first.
 *
 * Across every attempt, not just the last one: a concept missed once is noise,
 * the same concept missed three times over a fortnight is the thing to revise.
 */
route.get("/:id/weak-topics", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");
  const deckId = c.req.param("id");

  const rows = await db
    .select({
      concept: quizAttempts.concept,
      total: count(),
      wrong: sql<number>`count(*) filter (where not ${quizAttempts.correct})`,
    })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.deckId, deckId), eq(quizAttempts.userId, userId)))
    .groupBy(quizAttempts.concept)
    .having(sql`count(*) filter (where not ${quizAttempts.correct}) > 0`)
    .orderBy(sql`count(*) filter (where not ${quizAttempts.correct}) desc`)
    .limit(10);

  return c.json(
    rows.map((r) => ({
      concept: r.concept,
      wrong: Number(r.wrong),
      total: Number(r.total),
    })),
  );
});

route.delete("/:id", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");

  // Cards and reviews cascade from the foreign keys.
  await db
    .delete(decks)
    .where(and(eq(decks.id, c.req.param("id")), eq(decks.userId, userId)));

  return c.body(null, 204);
});

export default route;
