# Architecture — The Morning Edition

```mermaid
flowchart LR
    U[Reader's browser] -->|pages, auth| W[Next.js on Vercel]
    W -->|read profile, editions, items<br/>insert events (RLS)| S[(Supabase Postgres + Auth)]
    W -->|POST /editions/generate<br/>GET /editions/:id/pdf<br/>X-Service-Key| E[FastAPI engine on Render]
    E -->|service role: read events,<br/>write articles, editions, items| S
    E -->|fetch| R[RSS feeds + Google News RSS]
    E -->|one editor call per edition| O[OpenRouter LLM]
    E -->|ReportLab| P[PDF bytes streamed back]
```

## Components

**Next.js web app (Vercel).** Renders the landing page, sign-up, the 4-step onboarding, the newspaper front page,
story pages, the archive and the "What your paper knows about you" page. It talks to Supabase with the public anon
key only, so Row Level Security decides what each reader can see. The browser never calls the engine: it calls
Next.js API routes (`/api/generate`, `/api/events`, `/api/pdf/:id`), which check the session and then call the engine
with a shared `X-Service-Key`.

**Supabase (Postgres + Auth).** Six tables: `profiles`, `interests`, `articles` (a shared cache of everything
fetched), `editions` (one per reader per day), `edition_items` and `events` (the learning signals). RLS policies
limit every reader to their own rows. A trigger creates the profile on sign-up.

**FastAPI engine (Render).** Builds one edition per reader per day:

1. Recompute topic weights from the last 30 days of events.
2. Build a feed list from the reader's topics, custom phrases and region, plus 3 "Explore" topics they don't follow.
3. Fetch every feed in parallel (8 s timeout each; failures are skipped).
4. De-duplicate (URL + near-duplicate titles), drop old, repeated and skipped stories, and score the rest locally.
5. Make **one** OpenRouter call: the AI editor picks and orders stories and writes headlines, deks, summaries,
   key points, "why this", the editor's note and "Three Things".
6. Validate and repair the AI output. If the call fails for any reason, a local fallback edition is built from the
   scores and RSS snippets, so **a paper is always produced**.
7. Save the edition and render the same edition as a newspaper-style PDF with ReportLab on request.

## The learning loop

Every interaction is an event: opening a headline, **active reading time** on the story page (only while the tab is
visible and the reader is active), clicking through to the original, likes, dislikes and skips.

```
weight(topic) = clamp(base_weight + Σ delta(event) × 0.5^(age_days / 14), 0.1, 3.0)
```

Opens count a little (curiosity); reading time counts most (real interest): under 5 s is a small negative, 15 s+
grows to +0.30 at two minutes. Likes are +0.30, skips −0.15, dislikes −0.35. Positive events on an Explore story
create a new **learned** interest. Sources gain or lose a small affinity the same way. The `/interests` page shows
every weight with its ▲/▼ change since the last edition, plus reading-time stats per topic.

## Security

The OpenRouter key and Supabase service-role key exist only in the engine's environment. The browser only has the
Supabase anon key. No keys, stack traces or raw AI responses are logged, stored or shown to readers.
