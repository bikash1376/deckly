import { Hono } from "hono";
import { and, desc, eq, count } from "drizzle-orm";
import { cleanDeep, DECK_COLORS, type DeckColor } from "@retenit/shared";
import { createDb, notes, decks } from "@/db";
import { debit, refund, getBalance } from "@/lib/credits";
import { assertWithinRateLimit } from "@/lib/rate-limit";
import { errors } from "@/lib/errors";
import { generateSeed } from "@/ai/generate";
import type { AppEnv } from "@/env";

const route = new Hono<AppEnv>();

const MAX_BODY = 40_000;

function colorFor(id: string): DeckColor {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return DECK_COLORS[h % DECK_COLORS.length]!;
}

const serialise = (n: typeof notes.$inferSelect) => ({
  id: n.id,
  title: n.title,
  body: n.body,
  createdAt: n.createdAt.toISOString(),
  updatedAt: n.updatedAt.toISOString(),
});

route.get("/", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, c.get("userId")))
    .orderBy(desc(notes.updatedAt))
    .limit(200);

  return c.json(rows.map(serialise));
});

route.post("/", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");

  // The free tier caps notes, not characters. A cap on length would punish the
  // one student actually using the thing.
  const balance = await getBalance(db, userId);
  if (!balance.isPremium) {
    const existing = await db
      .select({ value: count() })
      .from(notes)
      .where(eq(notes.userId, userId));

    if (Number(existing[0]?.value ?? 0) >= balance.noteLimit) {
      throw errors.noteLimit(balance.noteLimit);
    }
  }

  const body = (await c.req.json().catch(() => null)) as
    | { title?: string; body?: string }
    | null;

  const inserted = await db
    .insert(notes)
    .values({
      userId,
      title: (body?.title ?? "").slice(0, 200),
      body: (body?.body ?? "").slice(0, MAX_BODY),
    })
    .returning();

  return c.json(serialise(inserted[0]!));
});

route.get("/:id", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, c.req.param("id")), eq(notes.userId, c.get("userId"))))
    .limit(1);

  if (!rows[0]) throw errors.notFound("That note");
  return c.json(serialise(rows[0]));
});

route.patch("/:id", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const body = (await c.req.json().catch(() => null)) as
    | { title?: string; body?: string }
    | null;

  const updated = await db
    .update(notes)
    .set({
      ...(body?.title !== undefined ? { title: body.title.slice(0, 200) } : {}),
      ...(body?.body !== undefined ? { body: body.body.slice(0, MAX_BODY) } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, c.req.param("id")), eq(notes.userId, c.get("userId"))))
    .returning();

  if (!updated[0]) throw errors.notFound("That note");
  return c.json(serialise(updated[0]));
});

route.delete("/:id", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  await db
    .delete(notes)
    .where(and(eq(notes.id, c.req.param("id")), eq(notes.userId, c.get("userId"))));
  return c.body(null, 204);
});

/** The bridge between the two halves of the product. */
route.post("/:id/deck", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");

  const rows = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, c.req.param("id")), eq(notes.userId, userId)))
    .limit(1);

  const note = rows[0];
  if (!note) throw errors.notFound("That note");
  if (note.body.trim().length < 40) {
    throw errors.invalid("There is not enough written yet to make a deck from.");
  }

  await assertWithinRateLimit(db, userId);
  await debit(db, userId, "seed", { fromNote: note.id });

  let seed;
  try {
    seed = await generateSeed(c.env, `${note.title}\n\n${note.body}`);
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
      sourceKind: "text",
      sourceRef: note.id,
      sourceText: note.body,
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

export default route;
