# Deckly — Technical Spec

> AI study decks for students. Drop in a topic, a paragraph, a PDF or a photo of your
> notes; get back a TL;DR, summary, key concepts, flashcards and a quiz. Plus a minimal
> writing pad with grammar checking and enhancement.

**Status:** pre-alpha, foundations only. Android first. Play Store target.

---

## 1. What this is

Students already paste their notes into ChatGPT. The gap isn't the generation — it's
that the output evaporates. Deckly makes the output an **artefact you come back to**:
a deck that remembers what you got wrong and asks you again in three days.

**The core loop:** input → deck → study → return tomorrow.

Two surfaces, one data model, because both are "text goes in, AI does something to it":

| Surface | What it is |
|---|---|
| **Decks** | AI-generated study material from a source (topic / text / PDF / photo) |
| **Pad** | A minimal note editor with selection-based grammar + enhance actions |

A note can be turned into a deck. That's the bridge, and it's the reason they ship together.

### Deliberately not in v1

Public deck sharing / Explore feed (needs moderation), collaboration, iOS, a web app,
admin panel, voice input, avatars and cosmetics. Each of these is a product on its own.

---

## 2. Stack

### Mobile

| Concern | Choice | Why |
|---|---|---|
| Framework | **Expo SDK 54** (RN 0.81, React 19.1) | Pinned. Do not upgrade mid-build. |
| Navigation | **expo-router** (file-based, typed routes) | |
| Styling | **Uniwind** + Tailwind v4 | 2x faster than NativeWind, full TW4. Tokens live in `global.css` as `@theme` — if a value isn't there, it doesn't exist. |
| Components | **react-native-reusables** | shadcn-for-RN. Copy-paste, Uniwind-compatible. Primitives only; distinctive components are hand-built. |
| Auth | **Clerk** (`@clerk/clerk-expo`) | Google OAuth, native flow, `expo-secure-store` token cache |
| Payments | **RevenueCat** (`react-native-purchases`) | Play Billing wrapper + entitlement sync |
| Server state | **TanStack Query** | |
| Local state | **Zustand** | Editor drafts, review session, UI state only |
| Icons | **@expo/vector-icons** (Feather) | Thin stroke matches the refs |
| Vector | **react-native-svg** | The folder-card silhouette |
| OCR | **ML Kit**, unbundled variant | ~0 MB APK; model via Play Services |
| Notifications | **expo-notifications** | Daily review reminder |

### Backend

| Concern | Choice | Why |
|---|---|---|
| Runtime | **Cloudflare Workers** + **Hono** | Cheap, fast cold starts, same vendor as R2 |
| Database | **Neon Postgres** + **Drizzle** | `@neondatabase/serverless` HTTP driver — the TCP driver doesn't work in Workers |
| Object storage | **Cloudflare R2** | PDFs and OCR images. Zero egress. |
| AI | **Vercel AI SDK** to a gateway, then **Groq** | `generateObject` + Zod for structured output. The gateway makes the model a one-string swap. |
| PDF text | **unpdf** | Runs in Workers. Page-capped, chunked beyond the cap. |

### Shared

`packages/shared` holds the Zod schemas for every AI output and the domain types.
Both the app and the Worker import from it, so a schema change breaks the build on
both sides at once. That's the point.

---

## 3. Architecture

```
┌─────────────┐
│  Expo app   │  Clerk session token on every request
└──────┬──────┘
       │ HTTPS
┌──────▼──────────────────────────────┐
│  Hono on Cloudflare Workers         │
│  · verify Clerk JWT (@clerk/backend)│
│  · check + debit credits  <- truth  │
│  · call AI, stream back             │
└───┬──────────────┬──────────┬───────┘
    │              │          │
┌───▼────┐   ┌─────▼────┐  ┌──▼──────────┐
│  Neon  │   │    R2    │  │ AI gateway  │ ──> Groq
│Postgres│   │ pdf/img  │  └─────────────┘
└────────┘   └──────────┘
     ▲
┌────┴───────────────┐
│ RevenueCat webhook │ ──> entitlements table
└────────────────────┘
```

### Security posture

- **The app never talks to Postgres.** The Worker is the only DB client, so
  authorisation is enforced in the API layer, not RLS. Every query is scoped by the
  `user_id` derived from the verified JWT — never from the request body.
- **No API keys in the app.** Groq, Neon and R2 credentials are Worker secrets.
- **Credits are debited server-side, before generation.** The client's idea of its own
  balance is a cache for greying out buttons — nothing more.
- **RevenueCat entitlements are trusted only via webhook**, never via the client SDK's
  word for it.

---

## 4. Data model

| Table | Holds |
|---|---|
| `users` | Clerk id to internal id, created_at, timezone |
| `decks` | title, subject, colour, source_kind, source_ref, status |
| `cards` | one row per generated artefact: `deck_id`, `kind`, `content` (jsonb), `model`, `prompt_version` |
| `notes` | writing pad documents, markdown body |
| `reviews` | SM-2 lite state per flashcard: `ease`, `interval`, `due_at`, `lapses` |
| `quiz_attempts` | per-question results, feeding weak-topic tracking |
| `entitlements` | `is_premium`, `credits`, `credits_reset_at`, RevenueCat ids |
| `ledger` | append-only credit debits/grants. Never mutate a balance without a row here. |

`cards.content` is jsonb validated against the matching Zod schema in
`packages/shared/src/ai-schemas.ts` before it is written.

---

## 5. Generation strategy

**Lazy, not eager.** Deck creation generates only the seed — title, subject, TL;DR,
outline, estimated minutes. Everything else generates when the user taps it.

This is the most consequential decision in the app:

- first result in ~2s instead of ~20s
- roughly 70% less token spend, since most users never open the cheat sheet
- the free tier stretches much further

Every generation goes through `generateObject` with a Zod schema. No prompt-and-parse.
Prompts are versioned per card kind and the version is stored on the row, so a prompt
change is traceable to the output it produced.

---

## 6. Monetization

**Everything is credits internally, including the free tier.** Free/paid tiers are rows
in a pricing table, not branches in code — because these numbers *will* be rebalanced in
month two, and that should be a deploy, not a refactor.

| Action | Credits |
|---|---|
| New deck (seed) | 10 |
| Flashcards / Quiz | 5 |
| Summary / Exam questions | 4 |
| Key concepts / Cheat sheet | 3 |
| Enhance (pad) | 2 |
| Deck chat / Grammar check | 1 |

**Free:** about 5 decks worth of credits per month, 2 notes, **unlimited review and
practice**. Reviewing costs nothing to serve and it is what builds the habit that makes
someone pay. A lifetime cap converts better on day one and kills you by day nine.

**Premium:** monthly + annual via RevenueCat, one entitlement. Annual at ~40% off will be
most of the revenue. Consumable credit packs are a v2 question, not a launch one.

---

## 7. Repo layout

```
deckly/
├── apps/
│   ├── mobile/              Expo app
│   │   ├── src/
│   │   │   ├── app/         expo-router routes
│   │   │   ├── components/  ui primitives + composed components
│   │   │   ├── features/    deck, pad, review, billing
│   │   │   ├── lib/         api client, auth, purchases, srs
│   │   │   ├── theme/       raw token mirror (non-className contexts only)
│   │   │   └── global.css   <- the design system, source of truth
│   │   └── metro.config.js  withUniwindConfig
│   └── api/                 Hono Worker
├── packages/
│   └── shared/              Zod schemas + domain types
├── ref/                     design reference screens
├── SPEC.md
└── CHECKLIST.md
```

---

## 8. Conventions

- **Styling is `className`, never `StyleSheet.create`.** The only escape hatch is
  `src/theme/tokens.ts`, for SVG fills and native APIs that cannot take a class.
- **No arbitrary values.** `bg-[#993344]` and `text-[17px]` do not pass review. If you
  need a value, add it to `@theme` first and justify it.
- **Two font families, five weights.** Adding a third family is a design change, not an
  implementation detail.
- Server owns truth for credits, entitlements and review scheduling. The client mirrors.
- Every AI response is schema-validated before it is stored or rendered.

---

## 9. Play Store constraints

These shape the timeline, so they are spec, not afterthought:

- New **personal** developer accounts must run a **closed test with 12+ testers for 14
  continuous days** before applying for production. Register the account and open the
  closed track *before* the app is finished — the clock is the constraint.
- GenAI apps must provide an **in-app way to report offensive AI output**. Every
  generated card gets a Report affordance.
- Required: privacy policy URL, Data Safety form, and **in-app account deletion** plus a
  public deletion URL.
- Digital content must use Play Billing. RevenueCat handles this.
