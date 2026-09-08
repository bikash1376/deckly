import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  real,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const deckColorEnum = pgEnum("deck_color", [
  "clay",
  "slate",
  "sage",
  "mocha",
  "eucalyptus",
  "plum",
]);

export const cardKindEnum = pgEnum("card_kind", [
  "seed",
  "summary",
  "key_concepts",
  "flashcards",
  "quiz",
  "cheat_sheet",
  "eli5",
  "exam_questions",
]);

export const sourceKindEnum = pgEnum("source_kind", ["topic", "text", "pdf"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    /** IANA zone. Needed to work out what "today" means for streaks. */
    timezone: text("timezone").notNull().default("UTC"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_clerk_id_idx").on(t.clerkId)],
);

/**
 * Credits and premium state.
 *
 * Split from `users` because it is written on a completely different cadence:
 * every generation touches this row, and nothing else touches the user row.
 */
export const entitlements = pgTable(
  "entitlements",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    isPremium: boolean("is_premium").notNull().default(false),
    credits: integer("credits").notNull().default(0),
    monthlyAllowance: integer("monthly_allowance").notNull().default(50),
    creditsResetAt: timestamp("credits_reset_at", { withTimezone: true }),
    noteLimit: integer("note_limit").notNull().default(2),
    revenueCatCustomerId: text("revenuecat_customer_id"),
    /** Product id of the active subscription, for support and debugging. */
    activeProductId: text("active_product_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

/**
 * Append only credit ledger.
 *
 * Balances are never adjusted without a row here. When a user says they were
 * charged for something that failed, this is the only way to answer them.
 */
export const ledger = pgTable(
  "ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Negative for a debit, positive for a grant. */
    delta: integer("delta").notNull(),
    /** `deck:seed`, `card:quiz`, `grant:monthly`, `grant:purchase`, `refund:failed`. */
    reason: text("reason").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ledger_user_created_idx").on(t.userId, t.createdAt)],
);

export const decks = pgTable(
  "decks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subject: text("subject").notNull(),
    color: deckColorEnum("color").notNull(),
    sourceKind: sourceKindEnum("source_kind").notNull(),
    /** The original topic, pasted text, or the R2 key for an upload. */
    sourceRef: text("source_ref").notNull(),
    /** Extracted text, kept so regenerating a card does not re-read the PDF. */
    sourceText: text("source_text"),
    fileName: text("file_name"),
    tldr: text("tldr").notNull(),
    outline: jsonb("outline").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull().default(10),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("decks_user_created_idx").on(t.userId, t.createdAt)],
);

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: cardKindEnum("kind").notNull(),
    /** Validated against the matching Zod schema before it is written. */
    content: jsonb("content").notNull(),
    model: text("model").notNull(),
    /** Which prompt produced this, so bad output is traceable to a version. */
    promptVersion: text("prompt_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cards_deck_kind_idx").on(t.deckId, t.kind)],
);

/**
 * One row per flashcard, holding its SM-2 state.
 *
 * Flashcards live inside a single `cards` row as a JSON array, so `cardIndex`
 * points into it. Denormalising front and back here would double the storage
 * and let the two copies drift.
 */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    cardIndex: integer("card_index").notNull(),
    ease: real("ease").notNull().default(2.5),
    interval: integer("interval").notNull().default(0),
    streak: integer("streak").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("reviews_card_index_idx").on(t.cardId, t.cardIndex),
    // The daily queue query is `where user_id = ? and due_at <= now()`.
    index("reviews_user_due_idx").on(t.userId, t.dueAt),
  ],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    concept: text("concept").notNull(),
    correct: boolean("correct").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quiz_attempts_user_deck_idx").on(t.userId, t.deckId)],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notes_user_updated_idx").on(t.userId, t.updatedAt)],
);

/** Streak bookkeeping. One row per day a user completed at least one review. */
export const reviewDays = pgTable(
  "review_days",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Local date in the user's timezone, as YYYY-MM-DD. */
    day: text("day").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [uniqueIndex("review_days_user_day_idx").on(t.userId, t.day)],
);

/**
 * Reports on generated content. Play Store requires an in-app way to flag
 * offensive AI output, and requires that somebody can actually see the reports.
 */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: uuid("card_id"),
    reason: text("reason").notNull(),
    detail: text("detail"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reports_created_idx").on(sql`${t.createdAt} DESC`)],
);

/**
 * Short lived upload tickets.
 *
 * The app asks for one, then PUTs the file to the Worker with the token. This
 * keeps R2 access keys out of existence entirely: there is nothing to presign
 * and nothing extra to leak.
 */
export const uploadTickets = pgTable(
  "upload_tickets",
  {
    token: text("token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    contentType: text("content_type").notNull(),
    maxBytes: integer("max_bytes").notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("upload_tickets_expires_idx").on(t.expiresAt)],
);
