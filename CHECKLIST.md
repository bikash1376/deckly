# Deckly — Build Checklist

AI study decks + a minimal writing pad. Expo RN · Clerk · RevenueCat · Hono on Cloudflare Workers · Neon Postgres · R2.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked / needs your input

---

## 0. Foundations

- [x] Initialize git repo + pnpm workspace (`apps/*`, `packages/*`)
- [x] Add GitHub remote `bikash1376/deckly`
- [x] `.gitignore` hardened (no `node_modules`, `.env`, `.dev.vars`, `android/`, `ios/`)
- [x] Scaffold Expo app (SDK 57, RN 0.86, expo-router, TypeScript)
- [x] `packages/shared` — Zod schemas shared between app and Worker
- [x] Design tokens from `/ref` (palette, spacing, radius, shadow)
- [x] Pin **Expo SDK 54** (RN 0.81, React 19.1) and reinstall the tree against it
- [x] Install mobile dependencies
- [x] Uniwind + Tailwind v4 wired (`metro.config.js`, `src/global.css`)
- [x] Design system as `@theme` tokens — colours, type scale, radii, gutter
- [x] `SPEC.md` — stack, architecture, data model, conventions
- [x] Push to `bikash1376/deckly`
- [x] Load Inter / Inter Tight via `expo-font`
- [ ] Init `react-native-reusables` and pull the primitives
- [x] `.env.example` for the app, `.dev.vars.example` for the Worker
- [ ] Rename project dir to `deckly` (space in path breaks local Gradle builds)

## 1. Design system (components)

- [x] `Text` — variant-only sizing, sanitises string children
- [x] `Button` — primary (ink pill), secondary, ghost, destructive
- [x] `IconButton` — circular, surface / sunken / ink / bare
- [x] `Card` + `PressableCard` — elevated / flat / outlined / sunken
- [x] `DeckCard` — the folder silhouette from `s3`
- [x] `Chip` — neutral, outline, semantic, and all six deck tones
- [x] `Segmented` — animated with `LinearTransition`
- [x] `Progress` — eased, deck-toned, works on coloured surfaces
- [x] `Input` — label, hint, error
- [x] `Skeleton` + `SkeletonCardBlock`
- [x] `EmptyState`
- [x] `TabBar` — floating pill, expanding active tab, regular-to-fill icon
- [x] `usePressScale` — the shared spring + haptic press feel
- [x] `Button` gained an `inverse` variant for deck-coloured grounds
- [ ] `Sheet` — bottom sheet wrapper
- [ ] `DeckStack` — layered deck hero from `s1`

## 2. Auth (Clerk)

- [x] `ClerkProvider` + `expo-secure-store` token cache
- [x] Google OAuth sign-in (native flow)
- [x] Onboarding carousel, three slides, gated on a SecureStore flag
- [x] Auth route guard / redirect logic
- [x] Account deletion screen with confirm dialog

## 2b. App data layer

- [x] Typed API client with Zod response parsing (`src/lib/api.ts`)
- [x] `useApi` bound to the live Clerk token
- [x] Wire entity schemas in `@deckly/shared` (Deck, Card, Note, ReviewCard, Me)
- [x] TanStack Query hooks: decks, review, notes, me
- [x] SM-2 lite scheduler mirrored client side (`src/lib/srs.ts`)
- [x] `cleanCopy` / `cleanDeep` applied to every parsed response
- [x] Offline cache persistence (queries only, never `me`, never mutations)

## 3. Backend — Worker API

- [ ] Hono app on Cloudflare Workers + `wrangler.jsonc`
- [ ] Clerk JWT verification middleware (`@clerk/backend`)
- [ ] Neon + Drizzle schema: `users`, `decks`, `cards`, `notes`, `reviews`, `ledger`, `entitlements`
- [ ] Migrations wired (`drizzle-kit`)
- [ ] Credit ledger — server is the only source of truth
- [ ] R2 bucket + presigned upload for PDFs and images
- [x] Quiz attempts recorded, weak topics aggregated across every attempt
- [x] Rate limiting per user, counted off the ledger
- [x] Error taxonomy with app-actionable codes

## 4. AI generation

- [ ] AI SDK client + gateway (Groq primary, one-string model swap)
- [ ] `POST /decks` → seed generation (title, TL;DR, outline)
- [ ] Lazy per-card generation: summary, key concepts, flashcards, quiz, cheat sheet, ELI5, exam questions
- [ ] Streaming responses to the app
- [ ] PDF text extraction (`unpdf`), page cap + chunk/map-reduce for long docs
- [ ] "Ask this deck" — chat grounded in the source
- [ ] Prompt library with a versioned prompt per card kind

## 5. OCR — photo of notes → deck

- [x] On-device OCR via ML Kit
- [x] **Unbundled ML Kit variant** via `plugins/with-unbundled-mlkit.js`.
      Confirmed the wrapper pulls all five bundled scripts unconditionally
      (Latin + Chinese + Devanagari + Japanese + Korean, roughly 20 MB). The
      plugin excludes them and adds `play-services-mlkit-text-recognition`.
- [x] `prefetchOcrModel`, called from onboarding
- [x] Camera + gallery capture flow, multi-page
- [x] Confidence heuristic, offers the stronger model when a page reads thin
- [ ] Server vision fallback for handwriting / diagrams / math (Groq vision), charged in credits
- [x] Multi-page capture into one deck

## 5b. Screens

- [x] Sign in (`(auth)/sign-in`)
- [x] Decks (`(tabs)/index`)
- [x] Pad (`(tabs)/pad`)
- [x] Review (`(tabs)/review`)
- [x] Profile (`(tabs)/profile`)
- [x] Create deck (`create`, modal)
- [x] Scan notes (`scan`, modal)
- [x] Paywall (`paywall`, modal)
- [x] Deck detail (`deck/[id]`)
- [x] Flashcards (`deck/[id]/flashcards`)
- [x] Quiz (`deck/[id]/quiz`)
- [x] Ask this deck (`deck/[id]/chat`)
- [x] Note editor (`note/[id]`)
- [x] Search (`search`)
- [x] Reminder settings (`settings/reminders`)
- [x] Onboarding carousel
- [x] Error boundary screen

## 6. Study features

- [x] Deck detail screen, card sections, generate-on-tap
- [x] Flashcards, flip and grade with predicted intervals
- [x] Spaced repetition client mirror, server owns the schedule
- [x] Daily review queue + reminder scheduling and settings screen
- [x] Quiz, explanation on answer, weak topics on the results screen
- [x] Streaks surfaced on Decks, Review and Profile
- [x] Deck chat screen

## 7. Writing pad (minimal)

- [x] Notes list screen with free-tier counter
- [x] Editor with autosave and selection tracking
- [x] Selection actions: Grammar check and Enhance, options never auto-applied
- [ ] Inline grammar issue highlighting + accept/dismiss
- [x] Turn this note into a deck
- [x] Debounced autosave

## 8. Monetization (RevenueCat)

- [x] RevenueCat SDK init, identity linked to the Clerk id
- [ ] Products: monthly + annual subscription
- [x] Paywall screen with offerings, purchase and restore
- [ ] Webhook → Worker → `entitlements` table
- [ ] Credit enforcement on every generation endpoint
- [ ] Free tier: 5 generations/month, 2 notes, unlimited review
- [ ] Credit meter UI + upgrade prompts at the right moment

## 9. Play Store readiness

- [ ] **Register Google Play developer account now** ($25, identity verification takes days)
- [ ] **Closed test with 12+ testers for 14 continuous days** (required for new personal accounts)
- [ ] Privacy policy URL (hosted)
- [ ] Data Safety form
- [ ] Account deletion URL (public, outside the app)
- [x] **In-app Report affordance** on generated cards, flashcards and quiz questions
- [ ] App icon, adaptive icon, feature graphic, screenshots
- [ ] Store listing copy + ASO title: `Deckly — AI Study Decks`
- [x] EAS build profiles (dev / preview / production AAB)
- [ ] Target API level check

## 9b. Build verification

- [x] Worker bundles clean (`wrangler deploy --dry-run`), 1.03 MB gzipped
- [x] App bundles clean (`expo export --platform android`)
- [x] Uniwind transform confirmed running (generates `src/uniwind-types.d.ts`)
- [x] Font bundle trimmed from 18 faces to 5, export 26 MB down to 16 MB
- [ ] Run on a real device (needs envs + a dev build)

## 10. Polish

- [x] Haptics on key interactions
- [x] Generation loading states (skeletons, not spinners)
- [x] Offline handling via a persisted query cache
- [x] Error boundaries
- [ ] Sentry or equivalent
- [ ] Analytics on the funnel: install → first deck → second session → paywall → purchase

---

## Open questions

- [!] Deck sharing / public "Explore" feed — deferred to v2 (needs moderation)
- [!] iOS — Android only for v1
- [!] Credit packs (consumables) vs subscription-only — subscription-only at launch
