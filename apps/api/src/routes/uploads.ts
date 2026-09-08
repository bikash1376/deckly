import { Hono } from "hono";
import { and, eq, lt } from "drizzle-orm";
import { createDb, uploadTickets } from "@/db";
import { errors } from "@/lib/errors";
import type { AppEnv } from "@/env";

const route = new Hono<AppEnv>();

const MAX_BYTES = 20 * 1024 * 1024;
const TICKET_TTL_MS = 10 * 60 * 1000;

/**
 * Uploads go through the Worker with a one use ticket, not a presigned S3 URL.
 *
 * Presigning R2 would mean creating and storing R2 access keys, which is a
 * second credential to leak for no benefit at this size: the cap is 20 MB,
 * comfortably inside a Worker request body. The ticket is single use and
 * expires, so a leaked one is worth one upload to the user's own key.
 */
route.post("/sign", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");

  const body = (await c.req.json().catch(() => null)) as
    | { fileName?: string; contentType?: string; size?: number }
    | null;

  if (body?.contentType !== "application/pdf") {
    throw errors.invalid("Only PDF files can be uploaded.");
  }
  if ((body.size ?? 0) > MAX_BYTES) {
    throw errors.invalid("That PDF is over 20 MB. Try a shorter section.");
  }

  const token = crypto.randomUUID().replace(/-/g, "");
  // Namespaced by user so one account's key can never address another's object.
  const key = `pdf/${userId}/${crypto.randomUUID()}.pdf`;

  await db.insert(uploadTickets).values({
    token,
    userId,
    key,
    contentType: body.contentType,
    maxBytes: MAX_BYTES,
    expiresAt: new Date(Date.now() + TICKET_TTL_MS),
  });

  // Opportunistic cleanup. Cheap, and it keeps a cron job off the todo list.
  await db.delete(uploadTickets).where(lt(uploadTickets.expiresAt, new Date()));

  const origin = new URL(c.req.url).origin;

  return c.json({
    uploadUrl: `${origin}/uploads/${token}`,
    key,
    expiresIn: Math.floor(TICKET_TTL_MS / 1000),
  });
});

route.put("/:token", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const userId = c.get("userId");
  const token = c.req.param("token");

  const rows = await db
    .select()
    .from(uploadTickets)
    .where(and(eq(uploadTickets.token, token), eq(uploadTickets.userId, userId)))
    .limit(1);

  const ticket = rows[0];
  if (!ticket) throw errors.notFound("That upload");
  if (ticket.consumedAt) throw errors.invalid("That upload link has already been used.");
  if (ticket.expiresAt.getTime() < Date.now()) {
    throw errors.invalid("That upload link expired. Try picking the file again.");
  }

  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0) throw errors.invalid("That file was empty.");
  if (bytes.byteLength > ticket.maxBytes) {
    throw errors.invalid("That PDF is over 20 MB. Try a shorter section.");
  }

  // Check the magic number rather than trusting the declared content type.
  const header = new Uint8Array(bytes.slice(0, 5));
  const isPdf =
    header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
  if (!isPdf) throw errors.invalid("That file is not a PDF.");

  await c.env.UPLOADS.put(ticket.key, bytes, {
    httpMetadata: { contentType: ticket.contentType },
  });

  await db
    .update(uploadTickets)
    .set({ consumedAt: new Date() })
    .where(eq(uploadTickets.token, token));

  return c.json({ key: ticket.key });
});

export default route;
