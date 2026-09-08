import { and, eq, sql } from "drizzle-orm";
import { CREDIT_COST } from "@deckly/shared";
import { entitlements, ledger, type Db } from "@/db";
import { errors } from "@/lib/errors";
import { startOfNextMonth, FREE_MONTHLY_CREDITS } from "@/middleware/auth";

/**
 * Credits, server side and authoritative.
 *
 * Two rules the rest of the codebase depends on:
 *
 *  1. Debit BEFORE generating, refund if generation fails. The other order
 *     lets a client cancel mid-request and get free output.
 *  2. Never write a balance without a matching ledger row. When a user says
 *     they were charged for something that did not work, the ledger is the only
 *     way to answer them.
 */

export interface Balance {
  credits: number;
  isPremium: boolean;
  monthlyAllowance: number;
  noteLimit: number;
}

/**
 * Read the balance, applying a monthly reset if one is due.
 *
 * The reset is lazy rather than a cron: a user who does not open the app does
 * not need their credits topped up, and a scheduled job over every row is a lot
 * of writes to achieve nothing.
 */
export async function getBalance(db: Db, userId: string): Promise<Balance> {
  const rows = await db
    .select()
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) throw errors.notFound("Your account");

  const due = row.creditsResetAt && row.creditsResetAt.getTime() <= Date.now();
  if (!due) {
    return {
      credits: row.credits,
      isPremium: row.isPremium,
      monthlyAllowance: row.monthlyAllowance,
      noteLimit: row.noteLimit,
    };
  }

  // Credits do not roll over. Rollover turns a subscription into a stockpile
  // and removes any reason to renew.
  const allowance = row.isPremium ? row.monthlyAllowance : FREE_MONTHLY_CREDITS;

  const updated = await db
    .update(entitlements)
    .set({
      credits: allowance,
      monthlyAllowance: allowance,
      creditsResetAt: startOfNextMonth(),
      updatedAt: new Date(),
    })
    .where(eq(entitlements.userId, userId))
    .returning();

  const next = updated[0]!;

  await db.insert(ledger).values({
    userId,
    delta: allowance - row.credits,
    reason: "grant:monthly",
    balanceAfter: allowance,
  });

  return {
    credits: next.credits,
    isPremium: next.isPremium,
    monthlyAllowance: next.monthlyAllowance,
    noteLimit: next.noteLimit,
  };
}

/**
 * Take credits for an action, or refuse.
 *
 * The debit is a single conditional UPDATE. Reading the balance and then
 * writing it back would let two requests in the same second each see enough
 * credits and both succeed; `credits >= cost` inside the WHERE makes the check
 * and the write one atomic step, so the second one matches no rows and loses.
 */
export async function debit(
  db: Db,
  userId: string,
  action: keyof typeof CREDIT_COST,
  metadata?: Record<string, unknown>,
): Promise<number> {
  const cost = CREDIT_COST[action];
  if (cost === undefined) throw errors.invalid(`Unknown action: ${action}`);
  if (cost === 0) return (await getBalance(db, userId)).credits;

  // Apply a pending reset first, so a user is not refused on the 1st of the
  // month with a full allowance waiting.
  await getBalance(db, userId);

  const updated = await db
    .update(entitlements)
    .set({ credits: sql`${entitlements.credits} - ${cost}`, updatedAt: new Date() })
    .where(and(eq(entitlements.userId, userId), sql`${entitlements.credits} >= ${cost}`))
    .returning({ credits: entitlements.credits });

  if (!updated[0]) {
    const balance = await getBalance(db, userId);
    throw errors.insufficientCredits(cost, balance.credits);
  }

  await db.insert(ledger).values({
    userId,
    delta: -cost,
    reason: `spend:${action}`,
    balanceAfter: updated[0].credits,
    metadata: metadata ?? null,
  });

  return updated[0].credits;
}

/**
 * Give credits back when the work did not happen.
 *
 * Called on any generation failure. A user who is charged for a model timeout
 * will not be a user for long.
 */
export async function refund(
  db: Db,
  userId: string,
  action: keyof typeof CREDIT_COST,
  reason: string,
): Promise<void> {
  const cost = CREDIT_COST[action];
  if (!cost) return;

  const updated = await db
    .update(entitlements)
    .set({ credits: sql`${entitlements.credits} + ${cost}`, updatedAt: new Date() })
    .where(eq(entitlements.userId, userId))
    .returning({ credits: entitlements.credits });

  if (!updated[0]) return;

  await db.insert(ledger).values({
    userId,
    delta: cost,
    reason: `refund:${action}`,
    balanceAfter: updated[0].credits,
    metadata: { reason },
  });
}

/** Grant credits on purchase or renewal. Driven by the RevenueCat webhook. */
export async function grant(
  db: Db,
  userId: string,
  amount: number,
  reason: string,
): Promise<void> {
  const updated = await db
    .update(entitlements)
    .set({ credits: sql`${entitlements.credits} + ${amount}`, updatedAt: new Date() })
    .where(eq(entitlements.userId, userId))
    .returning({ credits: entitlements.credits });

  if (!updated[0]) return;

  await db.insert(ledger).values({
    userId,
    delta: amount,
    reason,
    balanceAfter: updated[0].credits,
  });
}
