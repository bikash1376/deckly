# Retenit

AI study decks for students. Drop in a topic, a paragraph, a PDF or a photo of your
notes; get back a TL;DR, summary, key concepts, flashcards and a quiz that remembers
what you got wrong. Plus a minimal writing pad with grammar checking and rewrites.

Android first. See [SPEC.md](./SPEC.md) for the architecture and [CHECKLIST.md](./CHECKLIST.md)
for what is built and what is not.

```
apps/mobile      Expo SDK 54 app
apps/api         Hono Worker on Cloudflare
packages/shared  Zod schemas and domain logic used by both
```

---

## Setup

Nothing runs until the services below exist and their keys are in place. Budget about
half an hour of dashboard work.

### 1. Install

```bash
pnpm install
```

### 2. Create the services

| Service | What you need | Where |
|---|---|---|
| **Neon** | A Postgres project. Copy the **pooled** connection string. | neon.tech |
| **Clerk** | An application with **Google** enabled as a social provider. Copy the publishable and secret keys. | clerk.com |
| **Groq** | An API key. | console.groq.com |
| **Cloudflare** | An account, plus an R2 bucket named `retenit-uploads`. | dash.cloudflare.com |
| **RevenueCat** | A project with a Google Play app, a monthly and an annual product, and one entitlement. | revenuecat.com |

RevenueCat can wait. Without it the paywall shows a plain notice instead of plans, and
everything else works.

### 3. Fill in the keys

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Both files are gitignored. Two things people get wrong here:

- **Neon must be the pooled string** (`...-pooler.region.aws.neon.tech`). The direct
  connection does not work from a Worker at all.
- **`EXPO_PUBLIC_API_URL` must be `http://10.0.2.2:8787`**, not `localhost`. On an
  Android emulator, `localhost` is the emulator itself.

For anything deployed, do not use a file:

```bash
pnpm --filter @retenit/api exec wrangler secret put DATABASE_URL
```

### 4. Create the database tables

```bash
cd apps/api
DATABASE_URL="postgres://..." pnpm db:generate   # writes ./drizzle
DATABASE_URL="postgres://..." pnpm db:migrate
```

### 5. Run it

```bash
pnpm --filter @retenit/api dev        # Worker on :8787
```

The app needs a **development build**, not Expo Go: Clerk's native Google flow,
RevenueCat and ML Kit are all native modules that Expo Go does not contain.

```bash
cd apps/mobile
npx eas build --profile development --platform android
# install the APK, then:
pnpm start
```

### 6. Point RevenueCat at the Worker

Once the Worker is deployed, add a webhook in RevenueCat:

- URL: `https://<your-worker>/webhooks/revenuecat`
- Authorization header: the same value as `REVENUECAT_WEBHOOK_SECRET`

The webhook is the only thing that grants premium. Without it a purchase succeeds and
the user gets nothing.

---

## Working on it

```bash
pnpm typecheck                       # both packages
pnpm --filter @retenit/mobile start
pnpm --filter @retenit/api dev
```

A few conventions worth knowing before you write code. The reasoning is in
[SPEC.md](./SPEC.md) section 8.

- **Styling is `className`, never `StyleSheet.create`.** The design system lives in
  `apps/mobile/src/global.css` as Tailwind v4 `@theme` tokens. If a colour or size is
  not in there, it does not exist: `bg-[#993344]` will not resolve, and that is on
  purpose. `src/theme/tokens.ts` is the escape hatch, for SVG fills and native APIs
  that cannot take a class.
- **No em dashes, no emoji, anywhere a user reads.** Enforced by `cleanCopy` in
  `packages/shared/src/copy.ts`, which runs in the Worker before generated content is
  stored and again in the app before it renders. Models produce em dashes whatever the
  prompt says, so the prompt asks and the sanitiser enforces.
- **The server owns credits, entitlements and review scheduling.** The app mirrors them
  to grey out buttons and predict intervals; it never decides them.
- **Every AI response is schema validated** before it is stored or rendered.

---

## Shipping to Play

The long pole is not the code. A new **personal** Google Play developer account must run
a closed test with **12 or more testers for 14 continuous days** before it can apply for
production. Organisation accounts are exempt.

Register the account and open the closed track before the app is finished. The clock is
the constraint, and it runs in parallel with everything else.

Also required, all of which are built:

- Privacy policy URL and a Data Safety form
- In-app account deletion plus a public deletion URL
- An in-app way to report offensive AI output
