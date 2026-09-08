import { Hono } from "hono";
import { cors } from "hono/cors";
import { sql } from "drizzle-orm";
import { createDb, reports, users } from "@/db";
import { requireAuth } from "@/middleware/auth";
import { toResponse, errors } from "@/lib/errors";
import decksRoute from "@/routes/decks";
import notesRoute from "@/routes/notes";
import reviewRoute from "@/routes/review";
import meRoute from "@/routes/me";
import uploadsRoute from "@/routes/uploads";
import billingRoute from "@/routes/billing";
import type { AppEnv } from "@/env";

const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    // The only client is a native app, which sends no Origin header, so this
    // exists for the browser based tooling used during development rather than
    // as a security control. Authorisation is the Clerk token, not the origin.
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86_400,
  }),
);

app.onError((error, c) => toResponse(c, error));

app.notFound((c) =>
  c.json({ code: "not_found", message: "That endpoint does not exist." }, 404),
);

app.get("/health", (c) => c.json({ ok: true, environment: c.env.ENVIRONMENT }));

/**
 * Readiness, including the database.
 *
 * Separate from /health because it costs a round trip, so an uptime monitor can
 * poll the cheap one frequently and this one rarely. Returns latency and
 * nothing else: a health endpoint that leaks row counts or schema names is a
 * reconnaissance endpoint.
 */
app.get("/health/db", async (c) => {
  const started = Date.now();
  try {
    const db = createDb(c.env.DATABASE_URL);
    await db.select({ ok: sql<number>`1` }).from(users).limit(1);
    return c.json({ ok: true, latencyMs: Date.now() - started });
  } catch (error) {
    console.error("db health failed", String(error));
    return c.json({ ok: false, latencyMs: Date.now() - started }, 503);
  }
});

// Webhooks authenticate with their own shared secret, so they are mounted
// before the auth middleware rather than inside it.
app.route("/webhooks", billingRoute);

app.use("/me/*", requireAuth);
app.use("/me", requireAuth);
app.use("/decks/*", requireAuth);
app.use("/decks", requireAuth);
app.use("/notes/*", requireAuth);
app.use("/notes", requireAuth);
app.use("/review/*", requireAuth);
app.use("/uploads/*", requireAuth);
app.use("/report", requireAuth);

app.route("/me", meRoute);
app.route("/decks", decksRoute);
app.route("/notes", notesRoute);
app.route("/review", reviewRoute);
app.route("/uploads", uploadsRoute);

/**
 * Report generated content.
 *
 * Play Store requires a GenAI app to give users an in-app way to flag offensive
 * output, and requires that the reports go somewhere a human can read them.
 * The rows land in `reports`, ordered newest first by index.
 */
app.post("/report", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const body = (await c.req.json().catch(() => null)) as
    | { cardId?: string; reason?: string; detail?: string }
    | null;

  if (!body?.reason) throw errors.invalid("A report needs a reason.");

  await db.insert(reports).values({
    userId: c.get("userId"),
    cardId: body.cardId ?? null,
    reason: body.reason.slice(0, 100),
    detail: body.detail?.slice(0, 2_000) ?? null,
  });

  return c.json({ ok: true });
});

export default app;
