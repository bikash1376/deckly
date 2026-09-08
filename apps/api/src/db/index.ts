import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

export * from "./schema";

/**
 * A Drizzle client over Neon's HTTP driver.
 *
 * HTTP, not TCP: a Worker has no long lived socket to hold a connection pool
 * on, and the pooled TCP driver will not connect from one at all. The trade is
 * that each query is its own round trip, so batch where it matters rather than
 * looping queries.
 *
 * Built per request. Workers reuse an isolate across requests, and caching a
 * client keyed on a connection string that could differ between environments
 * is how you leak one tenant's connection into another's request.
 */
export function createDb(databaseUrl: string) {
  return drizzle(neon(databaseUrl), { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;
