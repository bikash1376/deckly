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
  AI_GATEWAY_API_KEY: string;
  GROQ_API_KEY: string;
  REVENUECAT_WEBHOOK_SECRET: string;
  REVENUECAT_SECRET_KEY: string;
}

export interface Vars {
  ENVIRONMENT: "development" | "production";
  /** Cheap and quick: seeds, chat, grammar. */
  MODEL_FAST: string;
  /** Used where wrong output is expensive: quizzes and exam questions. */
  MODEL_QUALITY: string;
}

export interface Bindings extends Secrets, Vars {
  UPLOADS: R2Bucket;
}

/** Everything hung on the Hono context by middleware. */
export interface Variables {
  userId: string;
  clerkId: string;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
