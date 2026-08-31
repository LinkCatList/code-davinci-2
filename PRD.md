# PRD: code-davinci — Developer Matching Bot for Telegram

**Status:** Draft v1
**Author:** melonges (solo)
**Date:** 2026-08-14

---

## 1. Overview

A Telegram bot where programmers meet other programmers by **swiping on code, not faces**. Inspired by [VSinder](https://github.com/benawad/vsinder) (a dating app inside VS Code), but rebuilt as a Telegram bot and positioned as **developer networking first** — dating, friendship, and collaboration are implicit outcomes, not separate modes.

The core hook: a candidate card is a **code snippet** with minimal info (name, stack, bio). The photo and full profile are revealed **only after a mutual like**. On match, the bot exchanges the parties' Telegram @usernames — there is no in-bot chat.

## 2. Background & Context

- **Reference product:** VSinder proved the "swipe on code" mechanic is fun and viral (2.5k GitHub stars, iOS/Android apps). It required installing a VS Code extension; a Telegram bot has near-zero install friction.
- **Previous attempt:** [code-davinci v1](https://github.com/melonges/code-davinci) (Bun + Telegraf + Prisma + PostgreSQL + Inversify DI + Docker Compose). Died after 15 commits.
- **Root cause of v1 failure:** **Overengineering.** Infrastructure (DI containers, Docker orchestration, Prisma Studio) was built before a single user-facing flow worked end-to-end.

> **Governing rule for v2:** No abstraction, service, or infra gets built until the product has real users who need it. Every P0 feature below should be re-asked: "can this be deleted?"

## 3. Goals & Success Metrics

Free forever, side project, no deadline. Success = a working product people actually use, and a codebase that stayed simple.

| Metric | Target (first ~2 months after launch) |
|---|---|
| Registered users (started onboarding) | 200 |
| Profile completion rate | ≥ 60% |
| Swipes per active user per day | ≥ 10 |
| Matches total | ≥ 30 |
| D7 retention (active again 7 days after signup) | ≥ 25% |
| Infra cost | $0 (Cloudflare free tier) |

Metrics are computed from D1 tables + a minimal `events` table (see §9), **excluding seed/fake profiles** (§6.6). No external analytics in MVP.

## 4. Non-Goals (v1)

Explicitly **out of scope** for MVP:

- ❌ In-bot chat / messaging between matches
- ❌ GitHub OAuth / GitHub data import
- ❌ Report/block/moderation tools, admin panel (accepted risk, see §11)
- ❌ Payments / premium tier / Telegram Stars
- ❌ Dating-specific filters (gender, "looking for", intent tags)
- ❌ Matching algorithms beyond simple filters (no scoring, no ML)
- ❌ Web app / Mini App / mobile apps
- ❌ Multiple photos, profile verification
- ❌ Docker, CI pipelines, staging environments, DI frameworks

## 5. Target Audience & Positioning

- **Who:** programmers (students to seniors) who hang out in Telegram dev communities.
- **Languages at launch:** Russian + English (bot UI fully i18n'd; default from user's Telegram locale, switchable via `/language`).
- **Positioning:** "Find devs worth knowing by reading their code." Networking-first; dating is an implicit, welcome side effect — hence **no dating filters and no dating framing in copy**. Matching signals are code and stack — gender is not one of them.

## 6. Core User Flows

### 6.1 Onboarding (`/start`)

Multi-step conversation (state persisted in D1 — see §9, `users.state`):

1. Choose language: 🇷🇺 RU / 🇬🇧 EN (pre-selected from Telegram locale).
2. Name (≤ 50 chars).
3. Birth year (validate 18+; reject otherwise — this is the only hard safety gate in MVP).
4. Gender (**required**, binary: male / female; display-only, never used in matching or filters).
5. Bio (optional, ≤ 300 chars).
6. Photo: exactly 1 (stored as Telegram `file_id`; **never shown in feed**, revealed on match).
7. Code snippet: paste code in a message (≤ 1500 chars), then pick language from a fixed inline-keyboard list (reuse v1's enum: Rust, C++, Java, Python, JS, TS, C#, Go, Swift, Kotlin, Ruby, PHP, etc.). Minimum 1, up to 3 in MVP.
8. Profile preview → confirm → enter feed.

If the user has **no @username**, warn during onboarding: "Matches are shared via @username. Set one in Telegram settings, otherwise matches can't be revealed." (Not a blocker — handled at match time, see §6.4.)

### 6.2 Feed / Swiping

- `/feed` (or after onboarding) shows candidate cards one at a time.
- **Card contents** (single message):
  - Code snippet rendered as a monospace code block (use HTML parse mode with `<pre>` to avoid MarkdownV2 escaping hell)
  - Name, age, snippet language + user's other languages, bio
  - **No photo.**
- Inline keyboard: `👍 Like` / `👎 Skip`.
- **Candidate selection:** not self, not already swiped (like or skip), active (not paused/deleted); real profiles first, then `last_active_at DESC`. When real unseen candidates run out → backfill with seed profiles (§6.6).
- **Filters** (`/filters`): snippet-language filter (default: any).
- Empty feed → friendly "no more candidates, check later / widen filters" message.

### 6.3 Likes

- Like stored (`likes` table, unique pair).
- **Likes are silent; digest notification instead of instant pings:** likes accumulate, and the recipient gets "you have N new likes" **at most once per 24h** — sent when a like arrives and the previous digest was > 24h ago (event-driven, no cron needed). Identity is never revealed. This is the main re-engagement loop.
- Skip is silent and permanent in MVP (no rewind).

### 6.4 Match & Reveal

On like, if a reciprocal like exists → create `matches` row, then send **both** users a reveal message:

- The other's **photo**, name, age, bio, all snippets
- Contact link: `https://t.me/<username>`

Edge case — **missing @username at match time:** the match is created, the side *with* a username gets "match pending"; the side *without* gets prompted to set a username; reveal completes on their next interaction once `from.username` is present.

### 6.5 Other commands

- `/profile` — view own profile as others see the card + edit fields (inline buttons per field).
- `/matches` — list of matches with reveal info + t.me links.
- `/delete` — wipe all user data (confirm first). Tiny feature, basic data hygiene.
- `/language` — switch RU/EN.

### 6.6 Seed (fake) profiles

To solve cold start, the DB is pre-filled with **generated fake profiles** before launch. Rules:

1. **Backfill only:** fakes appear in the feed only when the user has exhausted real unseen candidates (real-first ordering). This makes phase-out self-regulating — as real user density grows, fakes naturally stop appearing.
2. **Fakes never match:** a like on a fake is stored but never reciprocated; fakes never initiate likes and never contribute to like-digest notifications. *Rationale:* match reveal exchanges real Telegram @usernames — a fake has none, and a match that can never be revealed is worse than no match.
3. **Fakes have no photo** (`photo_file_id = NULL`): photos are only revealed on match, and fakes never match — so no fake faces are ever needed. This keeps seeding simple and avoids using generated/stolen photos of people.
4. **Flagged in DB:** `users.is_fake = 1`. Fakes are excluded from the §3 metrics funnel and from `events`.
5. **Generation:** one-off seed script (`scripts/seed.ts`, run via wrangler against D1) creating ~100–300 profiles: plausible RU/EN names, gender, bios, cities/coords spread across target dev hubs, and code snippets from a curated hand-written pool (per language). No AI-generation pipeline, no external APIs — a static data file + insert loop.
6. **Cleanup:** fakes can be bulk-deleted later via `is_fake` once real density is self-sustaining.

> Open experiment (P1, only if retention is weak): let fakes occasionally like *new* users to trigger the re-engagement notification. Deliberately NOT in MVP — fake notifications erode trust in the core loop.

## 7. Feature Requirements (prioritized)

**P0 — MVP (milestones M1–M5 in §12):**

| # | Feature | Notes |
|---|---|---|
| 1 | Onboarding + profile CRUD | Flow in §6.1; 18+ validation; preview + per-field edit |
| 2 | Code snippet management | Paste in bot; 1–3 snippets; ≤1500 chars; language tag from fixed list |
| 3 | Feed + like/skip | Card per §6.2; candidate selection + filters per §6.2 |
| 4 | Matching + reveal | Mutual like → match → photo + t.me link reveal to both; missing-username handling |
| 5 | Notifications | Match = instant reveal message; likes = digest "you have N new likes", max 1 per 24h (§6.3) |
| 6 | i18n RU/EN | All user-facing copy in two locale dictionaries |
| 7 | `/delete` data wipe | |
| 8 | Events logging | `events` table: `profile_complete`, `like`, `skip`, `match` for the §3 funnel |
| 9 | Seed profiles | One-off seed script + curated snippet pool; ~100–300 fake profiles (§6.6) |

**P1 — fast follow (only after real users exist):**

- Block + report button (the first thing to add if any abuse appears)
- Proactive re-engagement digest for users inactive 3+ days (requires Workers Cron Trigger — the MVP digest in §6.3 is event-driven only)
- 2–3 photos per profile; up to 5 snippets
- Referral deep links (`t.me/bot?start=ref_...`) to make the viral hook trackable
- Daily like cap (anti-spam), only if spam actually appears

**P2 — maybe later:**

- GitHub integration (import snippet from gist/repo; verified username badge)
- Telegram Mini App UI for richer cards
- Premium via Telegram Stars — **only if the "free forever" strategy changes**

## 8. UX & Copy Notes

- Tone: playful, dev-fluent ("compiling your matches…"), not cringe. RU and EN copy written natively, not translated literally.
- All cards/notifications exist in both locales from day one.
- The "code-first, photo-on-match" rule is the product's identity — never show photos in the feed.

## 9. Technical Design

### 9.1 Architecture

```
Telegram ──webhook──> Cloudflare Worker (grammY, webhookCallback)
                            │
                            ├── D1 (SQLite) ── users, snippets, likes, matches, events
                            └── Telegram Bot API ── sendMessage / sendPhoto (file_id)
```

- **Runtime:** Cloudflare Workers. No servers, no Docker, no Redis, no queues, no long polling.
- **Bot framework:** grammY (TypeScript), `webhookCallback` adapter.
- **DB:** Cloudflare D1 (SQLite).
- **ORM:** **Drizzle ORM (confirmed, §14)** — lightweight, first-class D1 support, runs on Workers without hacks.
- **Photos:** store Telegram `file_id` only; re-send via `sendPhoto(file_id)`. Zero file storage (no R2 in MVP).
- **Conversation state:** Workers are stateless → persist onboarding step in `users.state` column; the webhook handler resumes the flow from DB state. (Alternative: grammY conversations plugin with a D1 storage adapter — pick whichever is *less code*.)
- **i18n:** two plain TS dictionary modules (`ru.ts`, `en.ts`) + a `t(key)` helper. No i18n framework.
- **Cross-user notifications:** sent within the same webhook request via `ctx.api`, wrapped in `ctx.executionCtx.waitUntil` where appropriate.
- **Secrets:** `BOT_TOKEN` as Worker secret. Webhook path contains a random token segment.
- **Cost:** $0 at MVP scale (Workers + D1 free tiers).

### 9.2 Data model (D1 / SQLite, draft)

```sql
users(
  id            INTEGER PRIMARY KEY,   -- Telegram user id
  username      TEXT,                  -- refreshed on every interaction
  locale        TEXT NOT NULL,         -- 'ru' | 'en'
  state         TEXT,                  -- onboarding step, NULL = done
  name          TEXT NOT NULL,
  birth_year    INTEGER NOT NULL,
  gender        INTEGER NOT NULL,      -- binary: 0 = male, 1 = female (required at onboarding; display-only)
  bio           TEXT,
  photo_file_id TEXT,
  lang_filter   TEXT,                  -- filter, NULL = any
  is_active     INTEGER NOT NULL DEFAULT 1,  -- 0 = paused/deleted/blocked bot
  is_fake       INTEGER NOT NULL DEFAULT 0,  -- 1 = generated seed profile (§6.6)
  last_active_at INTEGER NOT NULL,
  last_like_notif_at INTEGER,          -- last time a likes-digest was sent (§6.3)
  created_at    INTEGER NOT NULL
)

snippets(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL,
         language TEXT NOT NULL, content TEXT NOT NULL, position INTEGER NOT NULL)

likes(id INTEGER PRIMARY KEY, from_user INTEGER NOT NULL, to_user INTEGER NOT NULL,
      created_at INTEGER NOT NULL, UNIQUE(from_user, to_user))

matches(id INTEGER PRIMARY KEY, user_a INTEGER NOT NULL, user_b INTEGER NOT NULL,
        revealed_a INTEGER NOT NULL DEFAULT 0, revealed_b INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL, UNIQUE(user_a, user_b))

events(id INTEGER PRIMARY KEY, user_id INTEGER, type TEXT NOT NULL, created_at INTEGER NOT NULL)
```

### 9.3 Project structure (deliberately flat)

```
src/
  index.ts        -- worker entry, webhook wiring
  bot.ts          -- grammY setup, middleware
  flows/          -- onboarding.ts, feed.ts, match.ts, profile.ts
  db/             -- schema.ts (drizzle), queries.ts
  i18n/           -- ru.ts, en.ts
  t.ts            -- t() helper
scripts/
  seed.ts         -- one-off fake-profile seeder (§6.6)
wrangler.toml
```

No `services/`, no `repositories/`, no DI container. Add structure only when pain is real.

## 10. Edge Cases

| Case | Handling |
|---|---|
| User has no @username at match | Pending reveal flow (§6.4) |
| User blocks the bot | `sendMessage` throws → set `is_active=0`; resume on next `/start` |
| Snippet > 1500 chars / empty | Reject with message, ask to resend |
| User < 18 years old | Onboarding hard-stop |
| Repeated `/start` | If mid-onboarding → resume from `state`; if done → show main menu |
| Duplicate like | `UNIQUE(from_user,to_user)` constraint; silently ignore |
| Code block formatting breaks | HTML parse mode, escape `<`, `>`, `&` in snippet content |

## 11. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Zero moderation in MVP** → harassment, fake/spam profiles | High | Accepted consciously. Fast-follow: block+report (P1) shipped at first sign of abuse. Telegram @usernames provide natural accountability. Monitor manually via D1 queries weekly. |
| **Cold start / empty marketplace** — new user opens feed, sees nobody | High | **Seed the DB with generated fake profiles (§6.6)** so the feed is never empty: fakes backfill the feed only when real unseen candidates run out, never match, and phase out automatically as real density grows. Plus: growth plan (§13) seeds one community first; global feed by default early on; good "empty state" copy. |
| **Overengineering relapse** (v1's cause of death) | High | This PRD's non-goals (§4) are the contract. Rule: nothing gets abstracted until it hurts twice. |
| Gender imbalance typical of dev spaces | None (accepted) | Non-issue by design: devs meet by code and stack, not gender. The product never promises romantic outcomes, and gender is never a filter or matching signal. |
| Solo dev, no deadline → drift | Medium | Milestones (§12) are small and demo-able; each ends with a working bot. |
| D1/Workers limits | Low | Far below free-tier limits at MVP scale. |

## 12. Milestones (no dates — each ends with a usable bot)

- **M1 — Skeleton:** Worker + webhook + grammY + D1 + Drizzle; `/start` replies in both locales; deployment pipeline = `wrangler deploy`. *Done when: bot answers in Telegram from Cloudflare.*
- **M2 — Profiles:** full onboarding flow, snippet CRUD, profile preview/edit. *Done when: a user can register and see their own card.*
- **M3 — Feed:** candidate selection, card rendering, like/skip, filters. *Done when: two test users can swipe on each other.*
- **M4 — Matching:** mutual-like detection, reveal messages with photo + t.me link, notifications, `/matches`, missing-username flow. *Done when: two test users match and receive each other's contacts.*
- **M5 — Launch polish:** `/delete`, events logging, copy polish in both languages, empty states, **seed DB with generated profiles (§6.6)**. *Done when: soft launch post goes out.*

## 13. Growth Plan (first ~100–200 users)

1. **Dev Telegram channels/chats** (primary): post in RU/EN programming communities — TON ecosystem chats (Tact/FunC background fits), local dev groups, language-specific chats. Pitch: "meet devs by their code."
2. **Twitter/X + Reddit**: launch posts in r/programming, r/Telegram, dev Twitter. VSinder's virality came from here — the "swipe on code" GIF/screenshot is the asset.
3. **Built-in viral hook:** make match screenshots funny/shareable; encourage "roast my code" sharing. Track with referral deep links (P1).

## 14. Decision Log

All former open questions resolved (2026-08-14):

1. **Branding:** name confirmed — **code-davinci**.
2. **ORM:** **Drizzle** confirmed (§9.1).
3. **Like notifications:** **digest**, not instant — max one "you have N new likes" per 24h (§6.3). Match reveals stay instant.
