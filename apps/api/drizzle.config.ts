import { defineConfig } from "drizzle-kit";

/**
 * Migrations run from your machine, not from the Worker. Reads DATABASE_URL
 * from the environment, so run these with the value from .dev.vars:
 *   DATABASE_URL="postgres://..." pnpm --filter @retenit/api db:generate
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
