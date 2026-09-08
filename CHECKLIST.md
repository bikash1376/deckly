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
- [ ] Typography scale + Inter / Inter Tight font loading
- [ ] Install mobile dependencies
- [ ] `.env.example` for both app and Worker
- [ ] Rename project dir to `deckly` (space in path breaks local Gradle builds)

## 1. Design system (components)

- [ ] `Text` — display / title / body / label / mono variants
- [ ] `Button` — primary (ink pill), secondary (outline), ghost, destructive
- [ ] `IconButton` — circular, white-on-surface (see `s1`, `s3`)
- [ ] `Card` — white surface, radius 24, soft shadow
- [ ] `DeckCard` — the folder shape from `s3` (SVG tab silhouette)
- [ ] `DeckStack` — layered/stacked deck from `s1`
- [ ] `Chip` / `Badge` — subject + status pills
- [ ] `SegmentedControl` — "My Deck / Collections" toggle from `s1`
- [ ] `ProgressBar` — thin, "7/14 lessons complete"
- [ ] `Sheet` — bottom sheet wrapper
- [ ] `Input` / `TextArea`
- [ ] `Skeleton` — shimmer placeholders for generation
- [ ] `EmptyState`
- [ ] `TabBar` — floating pill nav from `s1`

## 2. Auth (Clerk)

- [ ] `ClerkProvider` + `expo-secure-store` token cache
- [ ] Google OAuth sign-in (native flow)
- [ ] Onboarding carousel (see `s2` — 4 dots, "Your cards and create deck")
- [ ] Auth route guard / redirect logic
- [ ] Account deletion screen — **required by Play Store**

## 3. Backend — Worker API

- [ ] Hono app on Cloudflare Workers + `wrangler.jsonc`
- [ ] Clerk JWT verification middleware (`@clerk/backend`)
- [ ] Neon + Drizzle schema: `users`, `decks`, `cards`, `notes`, `reviews`, `ledger`, `entitlements`
- [ ] Migrations wired (`drizzle-kit`)
- [ ] Credit ledger — server is the only source of truth
- [ ] R2 bucket + presigned upload for PDFs and images
- [ ] Rate limiting per user
- [ ] Error taxonomy + structured logging

## 4. AI generation

- [ ] AI SDK client + gateway (Groq primary, one-string model swap)
- [ ] `POST /decks` → seed generation (title, TL;DR, outline)
- [ ] Lazy per-card generation: summary, key concepts, flashcards, quiz, cheat sheet, ELI5, exam questions
- [ ] Streaming responses to the app
- [ ] PDF text extraction (`unpdf`), page cap + chunk/map-reduce for long docs
- [ ] "Ask this deck" — chat grounded in the source
- [ ] Prompt library with a versioned prompt per card kind

## 5. OCR — photo of notes → deck

- [ ] On-device OCR via ML Kit — free, offline, printed text
- [ ] **Use the unbundled ML Kit variant** (`com.google.android.gms:play-services-mlkit-text-recognition`)
      via config plugin — ~0 MB APK cost vs ~4 MB bundled. Verify which variant the RN
      wrapper pulls by default (most default to bundled) and override the Gradle dep.
- [ ] Prefetch the OCR model during onboarding so the first scan has no wait
- [ ] Camera + gallery capture flow (`expo-image-picker`)
- [ ] Confidence heuristic: too few chars → offer server fallback
- [ ] Server vision fallback for handwriting / diagrams / math (Groq vision), charged in credits
- [ ] Multi-page capture → single deck

## 6. Study features

- [ ] Deck detail screen — card sections, generate-on-tap
- [ ] Flashcards — swipe, flip, hint
- [ ] Spaced repetition (SM-2 lite) + `reviews` scheduling
- [ ] Daily review queue + `expo-notifications` reminder
- [ ] Quiz — 4 options, explanation on answer, weak-topic tracking
- [ ] Streaks + weekly progress
- [ ] Deck chat screen

## 7. Writing pad (minimal)

- [ ] Notes list screen
- [ ] Editor — markdown-backed `TextInput`, formatting toolbar
- [ ] Selection-based AI actions: Grammar check, Enhance (options, never silent overwrite)
- [ ] Inline grammar issue highlighting + accept/dismiss
- [ ] "Turn this note into a deck"
- [ ] Autosave + offline draft

## 8. Monetization (RevenueCat)

- [ ] RevenueCat SDK init + user identity linked to Clerk id
- [ ] Products: monthly + annual subscription
- [ ] Paywall screen
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
- [ ] **In-app "Report" button on every AI-generated card** — required for GenAI apps
- [ ] App icon, adaptive icon, feature graphic, screenshots
- [ ] Store listing copy + ASO title: `Deckly — AI Study Decks`
- [ ] EAS build profiles (dev / preview / production AAB)
- [ ] Target API level check

## 10. Polish

- [ ] Haptics on key interactions
- [ ] Generation loading states (skeletons, not spinners)
- [ ] Offline handling + retry
- [ ] Error boundaries
- [ ] Sentry or equivalent
- [ ] Analytics on the funnel: install → first deck → second session → paywall → purchase

---

## Open questions

- [!] Deck sharing / public "Explore" feed — deferred to v2 (needs moderation)
- [!] iOS — Android only for v1
- [!] Credit packs (consumables) vs subscription-only — subscription-only at launch
