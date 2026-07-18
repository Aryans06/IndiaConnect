# IndiaConnect

**Find the government welfare schemes you actually qualify for.**

India runs thousands of welfare schemes — pensions, scholarships, housing, healthcare, farmer support. The problem was never that they don't exist. It's that citizens don't know they exist, can't tell whether they're eligible, and don't know which documents they need.

IndiaConnect turns that into a personal, actionable shortlist: answer a few plain questions and see the schemes meant for you, the documents you need (checked against your own DigiLocker), and the steps to apply — in your language, by voice if you prefer.

**3,874 schemes** across **36 states and union territories**, scraped from the government's own aggregator and normalized into a searchable, machine-checkable catalog.

---

## What it does

| Feature | Description |
|---|---|
| **Scheme directory** | Browse every scheme. Postgres full-text search (single-digit milliseconds across the catalog), filter by category and state, sort by closing deadline. |
| **Eligibility finder** | A guided, skip-friendly questionnaire → ranked matches with plain-language reasons. |
| **Deterministic matching** | Rule-based, explainable, reproducible. Never an LLM guess. |
| **Document matching** | Connect DigiLocker → see "have ✓ / still need ✕" per scheme, plus how to obtain what's missing. |
| **Application tracker** | Tick off application steps; progress is saved. |
| **AI assistant** | Ask in plain words. Answers are grounded in the real scheme catalog (RAG), never invented. |
| **Multilingual + voice** | 6 Indian languages. Speak your question, hear the answer — voice needs no API keys. |
| **Rate limiting** | Per-IP caps on every public and write endpoint, so the AI endpoint can't be run up as a cost or abuse vector. |

---

## Quick start

**Prerequisites:** Node 20+, PostgreSQL 14+

```bash
git clone https://github.com/Aryans06/IndiaConnect.git
cd IndiaConnect
npm install

# 1. Database
createdb indiaconnect
cp .env.example .env          # then set DATABASE_URL
npx prisma migrate dev        # create tables
npm run db:seed               # 20 curated schemes to start

# 2. Run
npm run dev                   # http://localhost:3000
```

That's enough for a fully working app. Everything below is optional — **the app degrades gracefully when a key is missing**, it never breaks.

---

## Environment

Copy `.env.example` → `.env`. Only `DATABASE_URL` is required.

| Variable | Required | What it unlocks |
|---|---|---|
| `DATABASE_URL` | **Yes** | Everything. |
| `GEMINI_API_KEY` | No | Eligibility-rule extraction, the AI assistant, and scheme translation. |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash`. ⚠️ See *Gemini quota* below. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` | No | Real phone/OTP sign-in. Without them, set `DEV_MOCK_AUTH=true` to sign in as a demo user. |
| `DIGILOCKER_*` | No | Real DigiLocker. Leave `DIGILOCKER_USE_MOCK=true` for a realistic mock. |
| `BHASHINI_*` | No | Optional translation provider. Gemini handles translation without it. |
| `ASSISTANT_RATE_LIMIT` / `ELIGIBILITY_RATE_LIMIT` | No | Per-IP requests/minute. Default 15 and 60. |

> ⚠️ **Never put keys in `.env.example`** — it's committed to git. Keys go in `.env`, which is gitignored.

### Gemini quota

Gemini's free-tier quota is **per-model**. `gemini-2.0-flash` returns `limit: 0`; use **`gemini-2.5-flash`**. The free tier also caps **requests per day**, which is why rule extraction is batched (see below).

---

## Populating the catalog

```bash
npm run db:seed          # 20 hand-verified central schemes (the reliable backbone)
npm run ingest           # scrape myScheme.gov.in — thousands of central + state schemes
npm run backfill:rules   # extract structured eligibility rules with Gemini
```

**`ingest`** is resumable and polite: it skips schemes already stored, backs off on 429s (myScheme rate-limits hard), and if Gemini is unavailable it still ingests schemes — just without rules, which you can backfill later.

**`backfill:rules`** normalizes ~10 schemes per Gemini request (the free tier caps *requests*, not tokens) and marks every processed scheme — including ones that legitimately yield zero rules — so re-runs never waste quota redoing dead ends. **Safe to re-run daily** until the backlog clears.

---

## Architecture

```
app/                    Next.js App Router
├─ page.tsx             landing
├─ schemes/             directory + detail pages (server-rendered for SEO)
├─ finder/              guided eligibility questionnaire
├─ assistant/           grounded AI chat (+ voice)
├─ account/             profile, documents, saved schemes, tracked applications
├─ api/                 eligibility, assistant, profile, bookmarks, applications, digilocker
└─ sitemap.ts robots.ts SEO — every scheme is indexable

lib/
├─ eligibility/         ★ the core: attributes, rules, deterministic matcher
├─ gemini/              rule extraction (ingest) + grounded assistant (RAG)
├─ translate/           provider layer: Bhashini → Gemini → English
├─ digilocker/          provider interface (mock for dev, OAuth for prod)
├─ myscheme/            scraper client (throttled, retries, backoff)
├─ i18n/                locale cookie, UI dictionaries, cached scheme translation
├─ voice.ts             Web Speech ASR + TTS (no keys required)
└─ rate-limit.ts        per-IP limits on public endpoints

scripts/                ingest + rules backfill
prisma/                 schema, migrations, curated seed
```

### Design decisions worth knowing

**Eligibility is rule-based, not LLM-judged.** Rules are structured (`attribute` + `operator` + `value`, with `orGroup` for OR-sets), so matching is deterministic, reproducible, and explainable — every result says *why*. Wrong eligibility info costs someone a real entitlement, so an LLM never adjudicates it. Gemini's job is to *extract* rules offline and to *converse* — never to decide.

**Three-state matching, not a boolean.** A scheme is `eligible`, `not_eligible`, or `needs_more_info` — and in the last case the engine returns **exactly which attributes are missing**. That's what lets the finder ask precise follow-up questions instead of demanding everything upfront.

**The assistant can't hallucinate benefits.** It retrieves from the real catalog first, then Gemini answers *using only those schemes*.

**One attribute registry drives everything.** `lib/eligibility/attributes.ts` defines each attribute once; the scraper, matcher, finder questionnaire, and profile form all read from it, so they can't drift apart.

**Every external dependency degrades gracefully.** No Gemini key → the assistant still returns real matching schemes. No Clerk → the public app works, auth is just unavailable. No DigiLocker → a realistic mock. No translation provider → English. The app never breaks because a key is missing.

**Search happens in the database, not in memory.** A GIN-indexed `tsvector` (weighted so a title match outranks a summary match) ranks the whole catalog in single-digit milliseconds. Terms are ANDed for precision and only loosened to OR if that returns nothing — so "farmer loan" means farming *and* lending, not any scheme that mentions a loan.

**A scheme with no rules is never reported as a match.** The matcher reads "no rules" as "open to everyone", which is true of hand-curated schemes but badly wrong for scraped ones whose criteria haven't been normalized yet. Only schemes with at least one structured rule can assert eligibility; the rest stay browsable but silent. Claiming eligibility without evidence is the exact harm this app exists to prevent.

---

## Development

```bash
npm run dev            # dev server
npm test               # 52 unit tests
npm run build          # production build
npx prisma studio      # browse the database
```

Tests cover the eligibility matcher, deadline logic, rate limiting, and the search query builder. The eligibility engine is the most correctness-critical unit and is covered by table-driven tests across every operator, AND/OR composition, missing-data handling, and ranking.

---

## Deploying

The app is Vercel-ready **except** for two things:

1. `DATABASE_URL` must point at a hosted Postgres (Neon, Supabase, Prisma Postgres) — not `localhost`.
2. Swap `lib/rate-limit.ts`'s in-memory store for Redis/Upstash. It's correct for a single Node process, but serverless instances don't share memory.

---

## Disclaimer

IndiaConnect is an independent guide, not a government service. Eligibility shown here is a simplified self-assessment aid — always confirm the full criteria on the official scheme website before applying.
