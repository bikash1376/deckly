import type { MiddlewareHandler } from "hono";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { createDb, users, entitlements } from "@/db";
import { errors } from "@/lib/errors";
import type { AppEnv } from "@/env";

/**
 * Verify the Clerk session token and resolve it to an internal user id.
 *
 * This is the only place a user identity enters the system. Every query
 * downstream scopes on `c.get("userId")`, never on anything from the request
 * body, because a body is whatever the caller decided to send.
 *
 * The first request from a new account creates the user and their entitlement
 * row. Doing it here rather than in a Clerk webhook means there is no window
 * where a signed in user has no row to write against, and no webhook to miss.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) throw errors.unauthorized();

  const token = header.slice(7);

  let clerkId: string;
  try {
    const payload = await verifyToken(token, { secretKey: c.env.CLERK_SECRET_KEY });
    if (!payload.sub) throw errors.unauthorized();
    clerkId = payload.sub;
  } catch {
    throw errors.unauthorized();
  }

  const db = createDb(c.env.DATABASE_URL);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (existing[0]) {
    c.set("userId", existing[0].id);
    c.set("clerkId", clerkId);
    return next();
  }

  // New account. Fetch the profile from Clerk rather than trusting claims,
  // which vary by JWT template.
  const clerk = createClerkClient({
    secretKey: c.env.CLERK_SECRET_KEY,
    publishableKey: c.env.CLERK_PUBLISHABLE_KEY,
  });

  const profile = await clerk.users.getUser(clerkId).catch(() => null);
  const email =
    profile?.emailAddresses.find((e) => e.id === profile.primaryEmailAddressId)?.emailAddress ??
    profile?.emailAddresses[0]?.emailAddress ??
    "";

  const inserted = await db
    .insert(users)
    .values({
      clerkId,
      email,
      name: profile?.firstName
        ? [profile.firstName, profile.lastName].filter(Boolean).join(" ")
        : null,
    })
    // Two requests can race on first launch. Whichever loses simply reads the
    // row the winner wrote.
    .onConflictDoUpdate({ target: users.clerkId, set: { email } })
    .returning({ id: users.id });

  const userId = inserted[0]!.id;

  await db
    .insert(entitlements)
    .values({
      userId,
      credits: FREE_MONTHLY_CREDITS,
      monthlyAllowance: FREE_MONTHLY_CREDITS,
      noteLimit: FREE_NOTE_LIMIT,
      creditsResetAt: startOfNextMonth(),
    })
    .onConflictDoNothing();

  c.set("userId", userId);
  c.set("clerkId", clerkId);
  return next();
};

/**
 * Free tier. Roughly five decks worth, which is the point: generous enough to
 * finish something, small enough that a real user runs out.
 *
 * These live here as the seed value only. The running balance is in the
 * `entitlements` row, so changing the tier is a migration, not a redeploy of
 * everyone's balance.
 */
export const FREE_MONTHLY_CREDITS = 60;
export const FREE_NOTE_LIMIT = 2;

export function startOfNextMonth(from = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
}
