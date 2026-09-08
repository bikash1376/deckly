import { Hono } from "hono";
import { eq, count, and, isNotNull } from "drizzle-orm";
import { createClerkClient } from "@clerk/backend";
import { createDb, users, entitlements, decks, reviews } from "@/db";
import { getBalance } from "@/lib/credits";
import { errors } from "@/lib/errors";
import { currentStreak } from "./review";
import type { AppEnv } from "@/env";

const route = new Hono<AppEnv>();

route.get("/", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");

  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) throw errors.notFound("Your account");

  // Reads the balance through getBalance so a due monthly reset is applied on
  // the first screen the user opens, rather than the first thing they try to
  // generate.
  const balance = await getBalance(db, userId);

  const entRows = await db
    .select({ creditsResetAt: entitlements.creditsResetAt })
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .limit(1);

  const [deckCount, reviewedCount, noteStreak] = await Promise.all([
    db.select({ value: count() }).from(decks).where(eq(decks.userId, userId)),
    db
      .select({ value: count() })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), isNotNull(reviews.lastReviewedAt))),
    currentStreak(db, userId),
  ]);

  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    entitlement: {
      isPremium: balance.isPremium,
      credits: balance.credits,
      creditsResetAt: entRows[0]?.creditsResetAt?.toISOString() ?? null,
      monthlyAllowance: balance.monthlyAllowance,
      notesUsed: 0,
      noteLimit: balance.noteLimit,
    },
    streak: noteStreak,
    decksCreated: Number(deckCount[0]?.value ?? 0),
    cardsReviewed: Number(reviewedCount[0]?.value ?? 0),
  });
});

/**
 * Account deletion.
 *
 * Play Store requires this to exist in the app and to actually delete rather
 * than deactivate. Rows cascade from the users row; the Clerk user goes last,
 * because if that succeeded first and the database write failed we would have
 * an orphaned account nobody can sign in to delete.
 */
route.delete("/", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");
  const clerkId = c.get("clerkId");

  await db.delete(users).where(eq(users.id, userId));

  const clerk = createClerkClient({
    secretKey: c.env.CLERK_SECRET_KEY,
    publishableKey: c.env.CLERK_PUBLISHABLE_KEY,
  });

  await clerk.users.deleteUser(clerkId).catch((error) => {
    // The data is already gone, which is the part that matters legally. Log
    // loudly so the dangling Clerk user can be cleaned up.
    console.error("clerk delete failed after data deletion", { clerkId, error: String(error) });
  });

  return c.body(null, 204);
});

export default route;
