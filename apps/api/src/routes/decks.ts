import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  CreateDeckInput,
  CardKind,
  cleanDeep,
  Flashcards as FlashcardsSchema,
  DECK_COLORS,
  type DeckColor,
} from "@deckly/shared";
import { createDb, decks, cards, reviews, uploadTickets } from "@/db";
import { debit, refund } from "@/lib/credits";
import { errors } from "@/lib/errors";
import { generateSeed, generateCard, answerQuestion } from "@/ai/generate";
import { extractPdf } from "@/ai/pdf";
import type { AppEnv } from "@/env";

const route = new Hono<AppEnv>();

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

  // Resolve the source to text BEFORE spending anything. A PDF that turns out
  // to be a scan should cost nothing.
  let sourceText: string;
  if (input.sourceKind === "pdf") {
    const ticket = await db
      .select()
      .from(uploadTickets)
      .where(and(eq(uploadTickets.key, input.source), eq(uploadTickets.userId, userId)))
      .limit(1);

    if (!ticket[0]?.consumedAt) throw errors.invalid("That upload could not be found.");

    const object = await c.env.UPLOADS.get(input.source);
    if (!object) throw errors.invalid("That upload has expired. Try uploading it again.");

    const extracted = await extractPdf(await object.arrayBuffer());
    sourceText = extracted.text;
  } else {
    sourceText = input.source;
  }

  // Debit first, refund on failure. The other order lets a client cancel
  // mid-request and keep the output for free.
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
      sourceRef: input.sourceKind === "pdf" ? input.source : "",
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
