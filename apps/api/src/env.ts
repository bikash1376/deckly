/**
 * Worker bindings and secrets.
 *
 * Everything in `Secrets` is set with `wrangler secret put` in a deployed
 * environment and read from `.dev.vars` locally. None of it is ever sent to the
 * app: the client gets a Clerk token and nothing else.
 */

export interface Secrets {
  /** Neon pooled connection string. The direct one does not work in a Worker. */
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  /** The model key. Required. Starts with `gsk_`. */
  GROQ_API_KEY: string;
  /**
   * Optional Cloudflare AI Gateway token, a completely different credential
   * from GROQ_API_KEY. Leave it blank and calls go straight to Groq; set it and
   * they route through the gateway for caching and spend visibility.
   */
  CF_AI_GATEWAY_TOKEN?: string;
  /** Shared secret the RevenueCat webhook must present. */
  REVENUECAT_WEBHOOK_SECRET: string;
}

export interface Vars {
  ENVIRONMENT: "development" | "production";
  /** Cheap and quick: seeds, chat, grammar. */
  MODEL_FAST: string;
  /** Used where wrong output is expensive: quizzes and exam questions. */
  MODEL_QUALITY: string;
}

/**
 * No object storage binding on purpose.
 *
 * A PDF is read for its text and then thrown away, so there is nothing to keep.
 * Storing the source document would mean holding a student's coursework
 * indefinitely, which is a liability with no product benefit: the deck is the
 * artefact, the PDF is just how it got here.
 */
export interface Bindings extends Secrets, Vars {}

/** Everything hung on the Hono context by middleware. */
export interface Variables {
  userId: string;
  clerkId: string;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
