# The Morning Edition

**A personal AI morning newspaper.** News is scattered across dozens of sites, and people jump from link to link
and still can't name three things they learned. The Morning Edition learns what you care about, gathers matching
stories from across the web every day, and has an AI editor turn them into one newspaper made just for you —
with a front page, story pages, a downloadable PDF, an archive, and a paper that gets better the more you read.

Built for NaSCon'26. `SPEC.md` is the full specification.

![Architecture](docs/architecture.png)

## Features

- **60-second onboarding** — name your paper (live masthead preview), tap topics (twice = love), add specific
  phrases, pick a reading style and region.
- **A real front page** — masthead, giant lead headline, columns of headlines and one-line deks, an In Brief rail.
- **Story pages** — summary, key points, *why you're seeing this*, and a link to the original article.
- **Newspaper PDF** — page 1 is the front page; inside pages hold the full stories in three columns, with
  clickable headlines.
- **Archive** of every past edition, on the web and as PDF.
- **It learns** from which headlines you open, **how long you actually read**, and what you like, dislike or skip.
  See it all on *What your paper knows about you*.
- **Three Things You Learned Today**, **Explore** stories from outside your usual topics, and **Regenerate**.
- **Always produces a paper** — if the AI fails, a local fallback edition is built from the sources.

## Architecture

Next.js (Vercel) + Supabase (Postgres, Auth, Row Level Security) + a Python FastAPI engine (Render) that fetches
RSS feeds, makes **one** OpenRouter call per edition, and renders PDFs with ReportLab.
See [docs/architecture.md](docs/architecture.md).

## Run it locally

**1. Database.** Create a Supabase project, turn off *Confirm email* (Authentication → Sign In / Providers), then
paste `supabase/schema.sql` into the SQL editor and run it once.

**2. Engine** (Python 3.11+), from `engine/`:

```bash
python -m venv .venv
source .venv/Scripts/activate   # Windows Git Bash; macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # fill in real values
uvicorn main:app --reload --port 8000
```

Check: `http://localhost:8000/health` → `{"ok": true}`. Tests: `python -m pytest` (OpenRouter is mocked; no credits).
Feed check: `python -m sources --verify`. Sample PDF: `python -m pdf.render samples/sample_edition.json out.pdf`.

**3. Web** (Node 20+), from `web/`:

```bash
npm install
cp .env.example .env.local      # fill in real values
npm run dev
```

Open `http://localhost:3000`, sign up, and print your first paper.

## Environment variables

`engine/.env` (server only — never committed):

| Name | What |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role / secret key |
| `OPENROUTER_API_KEY` | OpenRouter key |
| `OPENROUTER_MODEL` | e.g. `provider/model-name` |
| `SERVICE_SHARED_SECRET` | random string shared with the web app |
| `APP_PUBLIC_URL` | the web app's public URL |

`web/.env.local` (never committed):

| Name | What |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon / publishable key (browser-safe) |
| `ENGINE_URL` | engine URL (`http://localhost:8000` locally) |
| `SERVICE_SHARED_SECRET` | same value as the engine |

## How learning works

Each event moves a topic's weight: opens +0.10, likes +0.30, click-throughs +0.15, skips −0.15, dislikes −0.35,
and **reading time** from −0.05 (bounced in under 5 s) up to +0.30 (two minutes or more of active reading).
Events fade with a 14-day half-life, weights stay between 0.1 and 3.0, and liking an Explore story creates a new
learned interest. Every morning's ranking uses the new weights.

## How AI failure is handled

The engine retries once on timeouts, rate limits and server errors, repairs invalid output (unknown ids, wrong
lead count, missing fields, over-long text), and if anything still fails it builds the paper from local scores and
RSS snippets (`ai_status = fallback`) with a slim notice on the front page. A reader always gets a paper.
