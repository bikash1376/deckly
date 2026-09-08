import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb, users, entitlements } from "@/db";
import { grant } from "@/lib/credits";
import { startOfNextMonth } from "@/middleware/auth";
import type { AppEnv } from "@/env";

const route = new Hono<AppEnv>();

/** What a paying month is worth. Roughly sixty decks, which nobody will hit. */
const PREMIUM_MONTHLY_CREDITS = 600;
const PREMIUM_NOTE_LIMIT = 1_000;

/**
 * RevenueCat webhook.
 *
 * This is the ONLY thing that grants premium. The app's copy of RevenueCat's
 * customer info is used to decide when to refresh the UI, never to assert an
 * entitlement, because a client that can assert its own entitlement is a client
 * that can be patched to assert it for free.
 *
 * Mounted outside the auth middleware: the caller is RevenueCat, not a user,
 * so it authenticates with the shared secret instead of a Clerk token.
 */
route.post("/revenuecat", async (c) => {
  const expected = c.env.REVENUECAT_WEBHOOK_SECRET;

  // Fail closed when the secret has not been set yet. Without this the compare
  // below reads .length on undefined and throws, which surfaces as a 500: the
  // request is still rejected, but through a crash rather than a decision, and
  // a 500 tells a prober that something is broken rather than that they are
  // simply not allowed.
  if (!expected) {
    console.error("REVENUECAT_WEBHOOK_SECRET is not set, rejecting all webhooks");
    return c.json(
      { code: "unauthorized", message: "Webhooks are not configured." },
      401,
    );
  }

  const authorization = c.req.header("Authorization");

  // Constant time compare. A plain !== leaks the secret one byte at a time to
  // anyone patient enough to measure the response.
  if (!authorization || !timingSafeEqual(authorization, expected)) {
    return c.json({ code: "unauthorized", message: "Bad webhook secret." }, 401);
  }

  const payload = (await c.req.json().catch(() => null)) as
    | { event?: { type?: string; app_user_id?: string; product_id?: string; expiration_at_ms?: number } }
    | null;

  const event = payload?.event;
  if (!event?.type || !event.app_user_id) {
    return c.json({ code: "invalid_request", message: "Unreadable event." }, 400);
  }

  const db = createDb(c.env.DATABASE_URL);

  // app_user_id is the Clerk id, set by Purchases.configure in the app.
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, event.app_user_id))
    .limit(1);

  const userId = rows[0]?.id;
  if (!userId) {
    // 200, not 404. A retry will not find a user who does not exist, and
    // RevenueCat would keep retrying for hours.
    console.warn("webhook for unknown user", event.app_user_id);
    return c.json({ ok: true });
  }

  const activating = [
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
  ].includes(event.type);

  const deactivating = ["EXPIRATION", "BILLING_ISSUE"].includes(event.type);

  if (activating) {
    await db
      .update(entitlements)
      .set({
        isPremium: true,
        monthlyAllowance: PREMIUM_MONTHLY_CREDITS,
        noteLimit: PREMIUM_NOTE_LIMIT,
        activeProductId: event.product_id ?? null,
        expiresAt: event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
        creditsResetAt: startOfNextMonth(),
        updatedAt: new Date(),
      })
      .where(eq(entitlements.userId, userId));

    // Top up to the full allowance rather than adding to whatever is left, so
    // a renewal cannot be farmed by not spending.
    const current = await db
      .select({ credits: entitlements.credits })
      .from(entitlements)
      .where(eq(entitlements.userId, userId))
      .limit(1);

    const have = current[0]?.credits ?? 0;
    if (have < PREMIUM_MONTHLY_CREDITS) {
      await grant(db, userId, PREMIUM_MONTHLY_CREDITS - have, `grant:${event.type.toLowerCase()}`);
    }
  }

  if (deactivating) {
    // Credits already granted are kept. Taking back something a user paid for
    // is not worth the support thread.
    await db
      .update(entitlements)
      .set({
        isPremium: false,
        noteLimit: 2,
        activeProductId: null,
        updatedAt: new Date(),
      })
      .where(eq(entitlements.userId, userId));
  }

  return c.json({ ok: true });
});

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default route;
