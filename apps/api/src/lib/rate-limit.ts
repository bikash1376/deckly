import { and, eq, gte, sql, count } from "drizzle-orm";
import { ledger, type Db } from "@/db";
import { errors } from "@/lib/errors";

/**
 * Per user rate limiting on the endpoints that cost money.
 *
 * Counted off the ledger rather than a KV counter or a Durable Object. The
 * ledger already records every spend, is already indexed on (user_id,
 * created_at), and is already consistent with what was actually charged, so a
 * separate counter would be a second source of truth that could disagree with
 * the first. The cost is one extra query on generation endpoints, which each
 * make several already.
 *
 * Credits are the real spending limit. This exists for the narrower case of a
 * client stuck in a retry loop, where the user has plenty of credits and is
 * burning them in seconds through no intent of their own.
 */

const WINDOW_SECONDS = 60;
const MAX_SPENDS_PER_WINDOW = 15;

export async function assertWithinRateLimit(db: Db, userId: string): Promise<void> {
  const since = new Date(Date.now() - WINDOW_SECONDS * 1000);

  const rows = await db
    .select({ value: count() })
    .from(ledger)
    .where(
      and(
        eq(ledger.userId, userId),
        gte(ledger.createdAt, since),
        // Only spends. A monthly grant and its matching refunds should never
        // count towards a limit meant to catch runaway generation.
        sql`${ledger.reason} like 'spend:%'`,
      ),
    );

  if (Number(rows[0]?.value ?? 0) >= MAX_SPENDS_PER_WINDOW) {
    throw errors.rateLimited();
  }
}
