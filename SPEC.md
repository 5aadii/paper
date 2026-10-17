# SPEC.md — "The Morning Edition": A Personal AI Morning Paper

> **Read this first (for any AI assistant working on this repo):**
> This file is the single source of truth for the project. Follow the steps in order.
> Do not invent new architecture, rename fields, or change the data contracts in Section 5 without being told to.
> The hackathon is about **6–7 hours long**. Every step has a time box. When a step runs over, use the
> cut list in Section 14 instead of pushing on.

---

## 0. Project Background

### 0.1 The problem (from the hackathon brief)

News is scattered across dozens of sites, apps and newsletters. Social media has one feed. News has nothing like it.
People jump from link to link and still cannot name three things they learned.

### 0.2 What we are building

A web product that:

1. **Learns what a reader cares about** through a short, enjoyable onboarding.
2. **Gathers articles** that match those interests from across the web, every day.
3. **Edits them with AI** into one personal morning paper: it picks stories, writes headlines and short summaries, orders sections, and explains why each story was chosen.
4. Opens as a **newspaper front page** (headlines and one-line teasers only). Clicking a headline opens the **story page** to read it; the reader can **click through** to the original, **skip** what they don't want, and **download the paper as a newspaper-style PDF**.
5. Keeps an **archive** of previous papers.
6. **Gets better over time** by learning which headlines the reader opens, **how long they actually read each story**, and their likes, dislikes and skips.
7. Adds a creative layer: **"Three Things You Learned Today"**, which answers the problem statement directly, plus transparency on what the paper "knows" about the reader.

### 0.3 What the judges will see

| Brief requirement | Our answer |
|---|---|
| 1. Onboarding | 4-screen onboarding: name your paper (live masthead preview), pick topics (tap once = like, twice = love), add specific interests, choose reading style and region. Under 60 seconds. |
| 2. PDF | Freshly generated A4 newspaper PDF that mirrors the web: **page 1 is the front page** (masthead, volume/number, lead across the top, headlines and deks in 3 columns, editor's note, "Three Things", In Brief strip) with jump lines to **inside pages** holding the full stories by section. Clickable headlines. |
| 3. Webpage | The paper opens as a **real newspaper front page**: masthead, giant lead headline, column stories, briefs rail — headlines and one-line teasers only. Clicking a headline opens that **story's own page** (summary, key points, why-this, link to the original). Archive of past editions, one-click PDF of the same edition. |
| 4. Learning | Every interaction is an event: which headlines the reader opens, **how long they stay on each story page** (active reading time), click-throughs, likes, dislikes, skips. Topic weights are recomputed from events with time decay. A "What your paper knows about you" page shows the weights and how they changed. |
| 5. Room to Explore | "Three Things You Learned Today", "Why you're seeing this" on every story, daily "Explore" stories outside the reader's usual topics, optional quiz and read-aloud. |

### 0.4 What we are NOT building

- No mobile app.
- No full-text scraping of article pages (we use RSS titles and snippets only; the reader clicks through for the full story).
- No payments, no social features, no admin panel.
- No embeddings or vector database (topic weights are enough and are easy to explain in the demo).
- No complicated autonomous agents. Exactly **one** main AI call per edition.

---

## 1. Tech Stack and Why

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 14+ (App Router, TypeScript) + Tailwind CSS** | Full control over newspaper design; deploys to Vercel in minutes; developer already knows it. |
| Auth + DB | **Supabase** (Postgres + Auth + Row Level Security) | Free, fast to set up, works from both Next.js and Python. |
| Engine | **Python 3.11+ with FastAPI** | Python is best for RSS parsing (`feedparser`) and PDF generation (`reportlab`). |
| AI | **OpenRouter** chat completions API | Developer already has a key; model is configurable by env var. |
| PDF | **ReportLab (platypus)** | Pure Python, no system dependencies, works on Windows and Linux, supports multi-column layouts and clickable links. |
| News sources | **RSS feeds + Google News RSS search** | Free, no API keys, no rate-limit surprises during the demo. |
| Hosting | **Vercel** (web) + **Render** (engine) | Both deploy from GitHub with free tiers. |

### 1.1 Libraries (keep it to these)

**Python (`engine/requirements.txt`):**

```
fastapi
uvicorn[standard]
httpx
feedparser
supabase
reportlab
python-dotenv
pydantic
tzdata
pytest
```

> `tzdata` is required because Windows has no built-in timezone database and we use `zoneinfo("Asia/Karachi")`.

**Next.js (`web/package.json`):**

```
@supabase/supabase-js
@supabase/ssr
lucide-react
```

Tailwind comes with `create-next-app`. Do not add UI kits, state libraries or animation libraries unless a step says so.

---

## 2. Architecture

### 2.1 Diagram

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

### 2.2 How one edition is made (the pipeline)

```
Reader opens /today
   └─ Next.js checks Supabase: is there an edition for (user, today's date)?
        ├─ yes, status=ready      → render it
        ├─ yes, status=generating → show "printing" screen, poll every 2 s
        └─ no                     → POST /api/generate → engine /editions/generate (returns 202 immediately)
                                      Engine background task:
                                      1. Load profile + interests + recent events
                                      2. Recompute topic weights (learning)
                                      3. Build the feed list for the reader's topics/keywords/region
                                      4. Fetch all feeds in parallel (8 s timeout each, failures ignored)
                                      5. Normalise, de-duplicate, drop old and already-shown articles
                                      6. Score locally → top 40 candidates (+ 2–3 "explore" candidates)
                                      7. ONE OpenRouter call: choose, order, write headlines/summaries,
                                         editor's note, three things
                                      8. Validate the AI output; if it fails, use local fallback
                                      9. Save edition + items, set status=ready
```

### 2.3 Key rules

1. **The paper must always be produced.** If OpenRouter fails, the engine builds the edition from local scores and RSS snippets (`ai_status = "fallback"`).
2. **Secrets live only on servers.** The OpenRouter key and Supabase service role key are only in the engine's environment. The browser only ever has the Supabase anon (publishable) key.
3. **The browser never calls the engine directly.** It calls Next.js API routes, which check the session and then call the engine with `X-Service-Key`.
4. **One edition per user per day** (`unique(user_id, edition_date)`). "Regenerate" replaces that day's items.
5. **"Today" is the reader's local date**, from `profiles.timezone` (default `Asia/Karachi`).

---

## 3. Repository Structure

```
morning-paper/
├── SPEC.md                    ← this file
├── README.md
├── .gitignore
├── docs/
│   ├── architecture.md        ← mermaid diagram + explanation
│   └── architecture.png       ← exported diagram for submission
├── supabase/
│   └── schema.sql             ← run once in Supabase SQL editor
├── engine/                    ← Python FastAPI service
│   ├── main.py                ← FastAPI app + routes only
│   ├── config.py              ← env loading, constants
│   ├── db.py                  ← Supabase client + all DB functions
│   ├── sources.py             ← TOPICS catalogue (feeds + queries)
│   ├── fetcher.py             ← parallel RSS fetching + normalising
│   ├── ranking.py             ← dedupe, scoring, candidate selection
│   ├── learning.py            ← weight recomputation from events
│   ├── ai_editor.py           ← OpenRouter call, JSON parsing, validation
│   ├── prompts.py             ← prompt templates + PROMPT_VERSION
│   ├── edition_builder.py     ← orchestrates the pipeline end to end
│   ├── pdf/
│   │   ├── render.py          ← render_edition_pdf(edition: dict) -> bytes
│   │   └── fonts/             ← bundled TTF fonts (DejaVu Serif/Sans)
│   ├── samples/
│   │   └── sample_edition.json
│   ├── tests/
│   │   ├── test_ai_validation.py
│   │   ├── test_ranking.py
│   │   └── test_pdf.py
│   ├── requirements.txt
│   └── .env.example
└── web/                       ← Next.js app
    ├── app/
    │   ├── page.tsx                   ← landing
    │   ├── login/page.tsx
    │   ├── signup/page.tsx
    │   ├── onboarding/page.tsx
    │   ├── today/page.tsx
    │   ├── paper/[date]/page.tsx      ← front page of any edition by date
    │   ├── paper/[date]/story/[itemId]/page.tsx  ← story page (reading + read-time tracking)
    │   ├── archive/page.tsx
    │   ├── interests/page.tsx         ← "What your paper knows about you"
    │   └── api/
    │       ├── generate/route.ts
    │       ├── events/route.ts
    │       └── pdf/[editionId]/route.ts
    ├── components/
    │   ├── Masthead.tsx
    │   ├── FrontPage.tsx              ← broadsheet grid: headlines + deks only
    │   ├── HeadlineBlock.tsx          ← one clickable story on the front page
    │   ├── BriefsColumn.tsx
    │   ├── StoryView.tsx              ← story page body + actions
    │   ├── MoreStories.tsx            ← "Next in section" / "More from today's paper"
    │   ├── EditorsNote.tsx
    │   ├── ThreeThings.tsx
    │   ├── PrintingScreen.tsx
    │   └── onboarding/ (Step components)
    ├── lib/
    │   ├── supabase/client.ts         ← browser client
    │   ├── supabase/server.ts         ← server client (cookies)
    │   ├── topics.ts                  ← topic list for onboarding (mirrors engine/sources.py)
    │   ├── events.ts                  ← logEvent() helper (POST /api/events, keepalive)
    │   ├── useReadTimer.ts            ← active reading-time hook for the story page
    │   └── edition.ts                 ← loadEdition() → Edition contract
    ├── middleware.ts                  ← refresh session, protect routes
    └── .env.example
```

---

## 4. Environment Variables

### 4.1 `engine/.env` (never committed)

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-or-secret-key
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=provider/model-name
SERVICE_SHARED_SECRET=long-random-string
APP_PUBLIC_URL=https://your-app.vercel.app
```

### 4.2 `web/.env.local` (never committed)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
ENGINE_URL=http://localhost:8000
SERVICE_SHARED_SECRET=same-long-random-string-as-engine
```

> Newer Supabase projects label keys as **publishable** (browser-safe, use as anon key) and **secret** (server-only, use as service role key). Either naming works.

### 4.3 `.gitignore` (root)

```
.env
.env.local
.env*.local
__pycache__/
*.pyc
.venv/
venv/
node_modules/
.next/
*.pdf
!docs/*.pdf
```

Commit `engine/.env.example` and `web/.env.example` with placeholder values only.

---

## 5. Data Contracts (DO NOT CHANGE — other team members build against these)

### 5.1 Topic slugs

The canonical topic list. `engine/sources.py` and `web/lib/topics.ts` must use exactly these slugs.

| slug | label |
|---|---|
| `world` | World |
| `pakistan` | Pakistan |
| `business` | Business & Markets |
| `technology` | Technology |
| `ai` | Artificial Intelligence |
| `startups` | Startups |
| `programming` | Programming & Dev |
| `science` | Science |
| `space` | Space |
| `health` | Health |
| `climate` | Climate & Environment |
| `cricket` | Cricket |
| `football` | Football |
| `entertainment` | Film, TV & Culture |
| `gaming` | Gaming |

Custom interests use the slug `custom:<lowercase phrase>`, for example `custom:pakistan cricket team`.
Learned interests (from Explore clicks) use a normal topic slug with `kind = 'learned'`.

### 5.2 The Edition JSON (used by the PDF renderer and the web reader)

```json
{
  "edition_id": "uuid",
  "paper_name": "The Saad Chronicle",
  "reader_name": "Saad",
  "edition_date": "2026-10-17",
  "edition_number": 3,
  "reading_style": "balanced",
  "editors_note": "Good morning, Saad. Today ...",
  "ai_status": "success",
  "three_things": [
    { "text": "One-sentence takeaway.", "item_id": "uuid" }
  ],
  "sections": [
    {
      "name": "Technology",
      "items": [
        {
          "item_id": "uuid",
          "layout_role": "lead",
          "headline": "Headline under 90 characters",
          "dek": "One-line teaser shown on the front page, max 120 characters.",
          "summary": "Two or three sentences, shown on the story page.",
          "key_points": ["Short point from the snippet", "Another short point"],
          "why_this": "Because you follow AI and liked two similar stories.",
          "source_name": "The Verge",
          "published_at": "2026-10-17T03:10:00Z",
          "url": "https://original-article-url",
          "image_url": null,
          "topic": "technology",
          "is_explore": false
        }
      ]
    }
  ]
}
```

Rules:

- Exactly **one** item in the whole edition has `layout_role = "lead"`, and it is in the **first** section.
- `layout_role` is one of `lead`, `feature`, `standard`, `brief`.
- Sections are ordered by the reader's interest weight (highest first). A section named **"Briefs"** may appear last and contains only `brief` items.
- An optional section named **"Explore"** contains items with `is_explore = true`.
- `image_url` may be `null`. Renderers must handle missing images.
- All text fields are plain text (no HTML, no Markdown).
- `dek` is what the **front page** shows under a headline. `summary` and `key_points` are only shown on the **story page** (web) and the **inside pages** (PDF). `key_points` has 0–3 items and may be empty.

A complete example file must exist at `engine/samples/sample_edition.json` with at least 4 sections and 11 items so the PDF and web UI can be built before the engine works.

### 5.3 Event types

| event_type | when | value |
|---|---|---|
| `open` | reader clicks a headline on the front page and the story page opens | null |
| `read_time` | reader leaves a story page (back, next story, close tab, switch tab) | **active** seconds on that page, capped at 600 |
| `click_through` | reader opens the original article from the story page | null |
| `like` | thumbs up | null |
| `dislike` | thumbs down | null |
| `skip` | "Not for me" on a story (front page hover, or story page) | null |
| `quiz_correct` / `quiz_wrong` | optional quiz | null |

"Active" seconds means the tab was visible **and** the reader did something (scroll, mouse move, key press, touch) in the last 30 seconds. A tab left open in the background does not count as reading.

One `read_time` event is sent per visit to a story page. If the reader comes back to the same story later, that is a new `open` and a new `read_time`.

Each event row stores `topic` and `source_name` copied from the item so learning does not need joins.

---

## 6. Database Schema (`supabase/schema.sql`)

Run this whole file once in the Supabase SQL editor.

```sql
create extension if not exists "pgcrypto";

-- PROFILES -------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  paper_name text not null default 'The Morning Edition',
  region text not null default 'both' check (region in ('pakistan','global','both')),
  reading_style text not null default 'balanced' check (reading_style in ('quick','balanced','deep')),
  timezone text not null default 'Asia/Karachi',
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- INTERESTS ------------------------------------------------------------
create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  label text not null,
  kind text not null default 'topic' check (kind in ('topic','custom','learned')),
  base_weight real not null default 1.0,
  weight real not null default 1.0,
  previous_weight real,
  updated_at timestamptz not null default now(),
  unique (user_id, topic)
);

-- ARTICLES (shared cache of everything fetched) ------------------------
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text not null,
  source_name text,
  snippet text,
  image_url text,
  topic text,
  published_at timestamptz,
  fetched_at timestamptz not null default now()
);

-- EDITIONS -------------------------------------------------------------
create table if not exists public.editions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  edition_date date not null,
  edition_number int not null default 1,
  status text not null default 'generating' check (status in ('generating','ready','failed')),
  progress text,
  editors_note text,
  three_things jsonb not null default '[]'::jsonb,
  ai_status text not null default 'pending' check (ai_status in ('pending','success','fallback')),
  model_id text,
  prompt_version text,
  error_type text,
  created_at timestamptz not null default now(),
  unique (user_id, edition_date)
);

-- EDITION ITEMS --------------------------------------------------------
create table if not exists public.edition_items (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions(id) on delete cascade,
  article_id uuid not null references public.articles(id),
  section text not null,
  section_position int not null,
  position int not null,
  layout_role text not null check (layout_role in ('lead','feature','standard','brief')),
  headline text not null,
  dek text,
  summary text,
  key_points jsonb not null default '[]'::jsonb,
  why_this text,
  topic text,
  is_explore boolean not null default false,
  score real
);

-- EVENTS (learning signals) -------------------------------------------
create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  edition_id uuid references public.editions(id) on delete cascade,
  item_id uuid references public.edition_items(id) on delete cascade,
  topic text,
  source_name text,
  event_type text not null check (event_type in
    ('open','read_time','click_through','like','dislike','skip','quiz_correct','quiz_wrong')),
  value real,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_user on public.events(user_id, created_at desc);
create index if not exists idx_items_edition on public.edition_items(edition_id);
create index if not exists idx_editions_user_date on public.editions(user_id, edition_date desc);

-- AUTO-CREATE PROFILE ON SIGNUP ----------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ROW LEVEL SECURITY ---------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.interests     enable row level security;
alter table public.articles      enable row level security;
alter table public.editions      enable row level security;
alter table public.edition_items enable row level security;
alter table public.events        enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own interests" on public.interests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "read articles" on public.articles
  for select to authenticated using (true);

create policy "read own editions" on public.editions
  for select using (auth.uid() = user_id);

create policy "read own items" on public.edition_items
  for select using (exists (
    select 1 from public.editions e where e.id = edition_id and e.user_id = auth.uid()));

create policy "insert own events" on public.events
  for insert with check (auth.uid() = user_id);

create policy "read own events" on public.events
  for select using (auth.uid() = user_id);
```

The engine uses the service role key, which bypasses RLS, so it can write articles, editions and items.

---

## 7. Engine Specification (Python)

### 7.1 `config.py`

- Load `.env` with `python-dotenv`.
- Expose `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `SERVICE_SHARED_SECRET`, `APP_PUBLIC_URL`.
- Constants:

```python
EDITION_SIZE = {"quick": 8, "balanced": 11, "deep": 14}
SUMMARY_MAX_CHARS = {"quick": 220, "balanced": 380, "deep": 600}
MAX_CANDIDATES = 40
EXPLORE_CANDIDATES = 3
FEED_TIMEOUT_SECONDS = 8
MAX_ARTICLE_AGE_HOURS = 36       # fall back to 72 if fewer than 20 candidates
NO_REPEAT_LAST_N_EDITIONS = 3
WEIGHT_MIN, WEIGHT_MAX = 0.1, 3.0
EVENT_HALF_LIFE_DAYS = 14
```

- Never log or print the API keys. If a key is missing, the engine still starts; AI calls return a controlled failure and the edition uses the fallback.

### 7.2 `sources.py` — the topic catalogue

```python
TOPICS = {
    "technology": {
        "label": "Technology",
        "feeds": ["https://www.theverge.com/rss/index.xml", "https://feeds.arstechnica.com/arstechnica/index"],
        "query": "technology",
        "pakistan_feeds": [],
        "pakistan_query": "technology Pakistan",
    },
    # ... one entry per slug in Section 5.1
}
EXPLORE_POOL = ["science", "space", "climate", "health", "business", "entertainment"]

def google_news_rss(query: str, region: str) -> str:
    # region 'pakistan' -> hl=en-PK&gl=PK&ceid=PK:en ; otherwise hl=en-US&gl=US&ceid=US:en
    ...
```

Rules:

- Every topic must have at least one Google News query, so no topic can ever come back empty.
- Publisher feeds to try (verify each one; delete any that fail): BBC World/Tech/Business/Science/Health, Al Jazeera, The Verge, Ars Technica, TechCrunch, Hacker News (`hnrss.org`), Dawn (home, business, sport), ESPNcricinfo.
- Include a script `python -m sources --verify` that fetches each feed and prints OK/FAIL with the item count.

### 7.3 `fetcher.py`

```python
async def fetch_all(feed_specs: list[FeedSpec]) -> list[RawArticle]
```

- `FeedSpec = {url, topic, source_hint, is_explore}`.
- Fetch with `httpx.AsyncClient` (timeout 8 s, a normal browser-like User-Agent, follow redirects) using `asyncio.gather(..., return_exceptions=True)`. Parse bytes with `feedparser.parse(content)`.
- For each entry produce: `url`, `title`, `source_name` (entry source title, or feed title, or domain), `snippet` (strip HTML tags, collapse whitespace, max 500 chars), `image_url` (from `media_content`, `media_thumbnail` or enclosure if present, else None), `published_at` (UTC datetime, or None), `topic`, `is_explore`.
- Google News titles end with `" - Source Name"`. Split that off into `source_name`.
- A failed feed is logged as `feed_failed topic=<slug> host=<domain>` and skipped. Never crash.

### 7.4 `ranking.py`

**De-duplication:**

1. Exact: same normalised URL (lowercase host, strip query strings starting with `utm_`, strip trailing slash).
2. Near-duplicate titles: `difflib.SequenceMatcher(None, a, b).ratio() > 0.82` on lowercased titles → keep the one from the higher-weight topic, or the newer one.

**Filtering:**

- Drop articles older than `MAX_ARTICLE_AGE_HOURS` (widen to 72 h if fewer than 20 remain).
- Drop article URLs that appeared in the reader's last 3 editions.
- Drop article URLs the reader has skipped or disliked, ever.
- Drop titles shorter than 20 characters.

**Local score:**

```
recency      = 0.5 ** (hours_old / 18)              # unknown date → 0.5
topic_weight = interests[topic].weight              # explore items → 0.6
source_factor= 1 + 0.05 * clamp(source_affinity, -4, 4)
keyword_hits = number of the reader's custom phrases found in title+snippet
score        = topic_weight * recency * source_factor * (1 + 0.3 * keyword_hits)
```

**Candidate selection:**

- Take the top `MAX_CANDIDATES` by score, but **at most 8 per topic** so one topic cannot take over.
- Add the top `EXPLORE_CANDIDATES` explore articles.
- Return candidates with a short id (`c1`, `c2`, ...) for the AI call; keep a map from short id to article.

**Local fallback edition** (`build_fallback_layout(candidates, style)`):

- Highest score = lead; next 2 = features; then standard; the last 3 of the size = briefs.
- Headline = original title (truncated to 90 chars); dek = first sentence of the snippet (max 120 chars); summary = snippet truncated to the style limit at a word boundary; key_points = `[]`.
- `why_this` = template, for example `"From your interest in Technology."` or `"Matches your interest: pakistan cricket."`
- Editor's note = `"Good morning, {name}. Here are today's {n} stories picked for you."`
- `three_things` = first sentence of the snippets of the top 3 items.

### 7.5 `learning.py`

```python
EVENT_DELTAS = {
    "open": 0.10, "click_through": 0.15, "like": 0.30,
    "quiz_correct": 0.05, "skip": -0.15, "dislike": -0.35, "quiz_wrong": 0.0,
}

def read_time_delta(seconds: float) -> float:
    """Reading time is the strongest quiet signal of real interest."""
    if seconds < 5:
        return -0.05          # opened, then bounced straight back: headline was misleading or dull
    if seconds < 15:
        return 0.0            # skimmed
    return 0.05 + 0.25 * min(seconds, 120) / 120   # 15 s → ~0.08 ... 120 s+ → 0.30

def recompute_weights(interests, events, now) -> list[dict]:
    """
    weight(topic) = clamp(base_weight + Σ delta(e) * 0.5 ** (age_days(e) / 14), 0.1, 3.0)
    delta(e) = read_time_delta(e.value) for read_time events, else EVENT_DELTAS[e.type]
    """
```

Why this split: an `open` says "this headline caught my eye"; `read_time` says "the story was actually worth it". Together they separate curiosity from genuine interest. A topic the reader keeps opening but leaves in under 5 seconds gains almost nothing.

Also return a small reading summary per topic (opens, total active minutes, average seconds per story) for the `/interests` page.

- Save the old `weight` into `previous_weight` before writing the new one (the Interests page shows the change).
- **Learned topics:** if an event with a positive delta has a topic the reader does not have, create an interest row with `kind = 'learned'`, `base_weight = 0.0`, label from `TOPICS`. This is how Explore clicks grow new interests.
- **Source affinity:** per `source_name`, +1 for `click_through`/`like` or `read_time` ≥ 30 s, −1 for `skip`/`dislike` or `read_time` < 5 s. Returned as a dict to `ranking.py`; not stored.
- Pure functions with no DB calls inside them, so they can be unit-tested.

### 7.6 `prompts.py`

```python
PROMPT_VERSION = "editor_v1"

EDITOR_SYSTEM = """You are the editor of a personal morning newspaper made for one reader.
You receive the reader's profile and a list of candidate articles (title, source, topic, snippet).
Choose the stories, order them, and write the paper.

Rules:
- Use ONLY candidate ids from the list. Never invent stories, facts, numbers or quotes.
- Base every summary only on the title and snippet given. If the snippet is thin, keep the summary short.
- Select exactly {edition_size} stories. Exactly one has layout_role "lead".
- layout_role must be one of: lead, feature, standard, brief. Use 2 features. Use "brief" for the last 3 stories.
- Prefer stories that match the reader's highest-weight topics and custom interests.
- Include 1 or 2 candidates marked explore=true, in a section named "Explore".
- headline: clear and specific, no clickbait, max 90 characters. It is the main thing the reader sees on the front page.
- dek: one short teaser line shown under the headline on the front page, max 120 characters. Adds one fact the headline does not say. No clickbait, no questions.
- summary: {summary_rule}. Neutral tone. Shown when the reader opens the story.
- key_points: 0 to 3 short bullet facts (max 90 characters each), taken only from the snippet. Use an empty list if the snippet has nothing more to say.
- why_this: max 100 characters, explains the link to the reader's interests, written to the reader ("You follow...").
- section: use the topic labels given in the profile, or "Explore" or "Briefs".
- editors_note: max 60 words, warm, greets the reader by name, mentions 2 or 3 of today's stories.
- three_things: exactly 3 one-sentence takeaways a reader should remember today, each linked to a chosen story id.
- Return valid JSON only. No Markdown, no code fences, no extra text."""

EDITOR_USER = """Reader profile:
{profile_json}

Candidates:
{candidates_json}

Return JSON in exactly this shape:
{{
  "editors_note": "string",
  "stories": [
    {{"id": "c1", "section": "Technology", "layout_role": "lead",
      "headline": "string", "dek": "string", "summary": "string",
      "key_points": ["string"], "why_this": "string"}}
  ],
  "three_things": [{{"id": "c1", "text": "string"}}]
}}"""

SUMMARY_RULES = {
    "quick": "1 to 2 sentences, max 220 characters",
    "balanced": "2 to 3 sentences, max 380 characters",
    "deep": "3 to 4 sentences, max 600 characters",
}
```

**Profile JSON sent to the model** (compact, no personal data beyond first name):

```json
{"name": "Saad", "reading_style": "balanced", "region": "both",
 "topics": [{"slug": "ai", "label": "Artificial Intelligence", "weight": 2.1}],
 "custom_interests": ["pakistan cricket team"]}
```

**Candidate JSON:** `[{"id":"c1","title":"...","source":"...","topic":"ai","explore":false,"snippet":"first 400 chars"}]` (400, not less: the summary and key points can only use what is in the snippet).

### 7.7 `ai_editor.py`

```python
def run_editor(profile: dict, candidates: list[dict]) -> dict:
    """Returns {"success": True, "data": validated_dict, "model_id": ...}
       or {"success": False, "error_type": "...", "message": "..."}"""
```

**Request:**

```python
httpx.post(
    "https://openrouter.ai/api/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": APP_PUBLIC_URL,
        "X-Title": "The Morning Edition",
    },
    json={
        "model": OPENROUTER_MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    },
    timeout=60,
)
```

- Retry **once** after 2 seconds on HTTP 429 or 5xx, or on timeout. Then give up.
- If the model rejects `response_format` (HTTP 400 mentioning it), retry once without it.
- `error_type` values: `missing_key`, `timeout`, `rate_limited`, `http_error`, `invalid_json`, `invalid_schema`, `empty_response`.
- Never put the API key, headers or the full raw response into logs, the DB or error messages.

**Parsing (`extract_json`):** strip whitespace; if it starts with a code fence, remove the fence lines; if it still fails, take the substring from the first `{` to the last `}` and try again; catch `json.JSONDecodeError`.

**Validation (`validate_editor_output(data, candidate_ids, edition_size, style)`):**

| Field | Rule | If invalid |
|---|---|---|
| `stories` | list | `invalid_schema` → fallback |
| `stories[].id` | must be in candidate ids; no duplicates | drop the story |
| `layout_role` | in allowed set | becomes `standard` |
| lead count | exactly 1 | if 0: highest-local-score story becomes lead; if >1: keep the first, others become `feature` |
| `headline` | non-empty string | use the original title; truncate to 90 chars |
| `dek` | non-empty string | first sentence of the snippet; truncate to 120 chars |
| `summary` | string | use the snippet; truncate to style limit at a word boundary |
| `key_points` | list of strings | keep max 3 non-empty, each truncated to 90 chars; anything else → `[]` |
| `why_this` | string | template; truncate to 100 chars |
| `section` | string | the topic label of the candidate |
| story count | at least 5 valid stories | otherwise fill from the local ranking (fallback items) up to edition size |
| `editors_note` | string | template; truncate to 400 chars |
| `three_things` | list of 3 with valid ids | drop invalid ones; fill from top stories' summaries |

### 7.8 `edition_builder.py`

```python
async def generate_edition(user_id: str, force: bool = False) -> str:  # returns edition_id
```

Step by step:

1. Load profile. Compute `edition_date` in the reader's timezone.
2. If an edition exists for that date and `force` is false, return it. If `force`, delete its items and reuse the row. Otherwise insert a new row with `status='generating'` and `edition_number = previous count + 1`.
3. Update `progress` as you go: `"Reading your interests"`, `"Collecting today's stories"`, `"The editor is choosing"`, `"Setting the type"`. The web printing screen shows these.
4. Load interests and the last 30 days of events → `recompute_weights` → save.
5. Build feed specs: for each interest with weight ≥ 0.3, its topic feeds plus its Google News query (for `region` both, use both the global and the Pakistan query); for each custom interest, a Google News query; plus 3 random topics from `EXPLORE_POOL` that the reader does not follow (marked explore).
6. `fetch_all` → upsert into `articles` (on conflict url, update `fetched_at`) → rank → candidates.
7. `run_editor`. On success use its layout; on failure use `build_fallback_layout` and set `ai_status='fallback'` and `error_type`.
8. Insert `edition_items` with `section_position` (sections ordered: lead's section first, then by weight, then Explore, then Briefs) and `position`.
9. Set `status='ready'`, `editors_note`, `three_things` (with real item UUIDs), `model_id`, `prompt_version`.
10. Wrap everything in try/except: on any unexpected error set `status='failed'`, `error_type='internal'`, log a short message (no secrets).

```python
def load_edition_json(edition_id: str) -> dict   # builds the Section 5.2 contract from the DB
```

### 7.9 `main.py` — API routes

All routes except `/health` require header `X-Service-Key: <SERVICE_SHARED_SECRET>`; otherwise return 401.

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/health` | — | `{"ok": true}` |
| POST | `/editions/generate` | `{"user_id": "...", "force": false}` | `202 {"edition_id": "...", "status": "generating"}`. Work runs in `BackgroundTasks`. |
| GET | `/editions/{edition_id}/pdf` | `?user_id=...` | `application/pdf`, filename `morning-edition-YYYY-MM-DD.pdf`. 404 if the edition is not that user's. |
| POST | `/learning/recompute` | `{"user_id": "..."}` | updated weights list |

Run locally: `uvicorn main:app --reload --port 8000` from `engine/`.

### 7.10 `pdf/render.py` — the newspaper PDF

```python
def render_edition_pdf(edition: dict) -> bytes
```

Input is exactly the Section 5.2 contract. Output is PDF bytes. No DB or network access inside this module (except optional lead image download with a 4 s timeout, skipped on any error).

**Page:** A4 portrait, 36 pt margins. Background off-white `#FBF8F1` drawn in the page callback; ink `#1A1A1A`; accent rules `#1A1A1A`; muted text `#555555`.

**Fonts:** register bundled TTFs from `pdf/fonts/` (DejaVu Serif, DejaVu Serif Bold, DejaVu Serif Italic, DejaVu Sans). If they are missing, fall back to `Times-Roman` / `Times-Bold` / `Helvetica`.

**Page 1 (PageTemplate "First"):**

1. **Masthead** (drawn in the `onPage` callback, top ~120 pt):
   - Thin rule, then the paper name centred, serif bold, 40–46 pt (shrink to fit width).
   - Thick rule + thin rule (classic double rule).
   - One info line in 8 pt sans: left `VOL. 1 · NO. {edition_number}`, centre the long date (`Saturday, 17 October 2026`), right `PREPARED FOR {READER NAME}`.
   - Thin rule.
2. **Page 1 is the FRONT PAGE** — headlines and deks only, exactly like the web front page (Section 8.6):
   - **Lead** (full width, about 200 pt tall, `KeepInFrame(mode="shrink")`): headline 28 pt serif bold, dek 12 pt serif italic, optional image on the right third, byline, and a jump line `Full story, page 2 →` (8 pt sans).
   - **Below the lead, three columns:** every `feature` and `standard` item as headline + dek + byline + jump line (`→ p.2`, `→ p.3` — the page where the full story actually lands; compute it with a first dry-run build, or simply write `→ inside` if short on time).
   - **Right-most column bottom:** **Editor's Note** box (`#EFEBE0`, "FROM THE EDITOR") and the **"THREE THINGS TO REMEMBER TODAY"** box.
   - **Bottom strip across the page:** "IN BRIEF" — the `brief` items as one-line headlines separated by `·`.
   - Page 1 must fit on one page: shrink fonts slightly or drop deks from standard items if it overflows.
3. **Inside pages (PageTemplate "Later")** — the full stories, section by section, in three columns: small running header (paper name left, `Section · date` right, thin rule), footer with page number centred and `Read the originals at {APP_PUBLIC_URL}`. Each story shows headline, byline, summary, key points as small bullets, `why_this`, and the clickable link to the original.

**Story styles (inside pages):**

- Section header: 9 pt sans bold uppercase with letter spacing, thick rule above, small space below. Use `KeepWithNext`/`CondPageBreak` so headers never sit alone at the bottom of a column.
- Feature: 15 pt serif bold headline; summary 9.5 pt serif, justified, leading 12.5.
- Standard: 12 pt serif bold headline; summary 9 pt.
- Brief: a bullet line, headline 9 pt bold followed by the summary's first sentence.
- Every headline is a clickable link: `<a href="{url}">{headline}</a>` (link colour = ink, no underline).
- Byline under each story: `SOURCE NAME · 3h ago` 7.5 pt sans muted.
- `why_this` under features only: 7.5 pt italic muted, prefixed by `Why this: `.
- Explore section header text: `EXPLORE — SOMETHING NEW`.

**Critical:** escape `&`, `<`, `>` in all text before putting it into a `Paragraph` (`xml.sax.saxutils.escape`), except inside the `<a>` tag you build yourself. Unescaped `&` is the most common ReportLab crash.

**Test:** `python -m pdf.render samples/sample_edition.json out.pdf` must produce a good-looking PDF with no exceptions.

### 7.11 Tests (keep small — time is limited)

- `test_ai_validation.py`: fenced JSON parses; garbage returns `invalid_json`; unknown ids dropped; zero leads fixed; two leads fixed; too few stories filled; long headline truncated.
- `test_ranking.py`: duplicate URL removed; near-duplicate titles removed; skipped URL excluded; per-topic cap respected.
- `test_pdf.py`: rendering the sample returns bytes starting with `%PDF`; text with `&` and `<` does not crash; an edition with no images works.
- All tests mock OpenRouter. **Tests must never spend credits.**

---

## 8. Web Specification (Next.js)

### 8.1 Visual design system — "newsprint"

| Token | Value |
|---|---|
| Paper background | `#FBF8F1` |
| Ink | `#1A1A1A` |
| Muted | `#5F5A50` |
| Rule | `#1A1A1A` (1 px thin, 3 px thick) |
| Accent (links, active chips) | `#8B1E1E` (deep newspaper red) |
| Headline font | **Playfair Display** (via `next/font/google`) |
| Body font | **Source Serif 4** |
| Labels / UI | **Inter**, small caps style: uppercase, `tracking-widest`, 11–12 px |

Principles: generous whitespace, thin rules instead of cards with shadows, no rounded "SaaS" boxes in the reader, serif everywhere except labels and buttons. Mobile: single column; desktop: 3–4 columns. Respect `prefers-reduced-motion`.

### 8.2 Auth and routing (`middleware.ts`)

- Use `@supabase/ssr` with the standard cookie pattern for the App Router.
- Email + password sign-up and login (in Supabase dashboard: **Authentication → turn off "Confirm email"** for the hackathon, so sign-up works instantly).
- Logged out and visiting `/today`, `/archive`, `/paper/*`, `/interests`, `/onboarding` → redirect to `/login`.
- Logged in but `profiles.onboarded = false` → redirect to `/onboarding`.
- Logged in and visiting `/`, `/login`, `/signup` → redirect to `/today`.
- Sign-up form collects first name and sends it as `options.data.display_name` (the DB trigger saves it).

### 8.3 Landing page `/`

- Big masthead-style title "The Morning Edition", subtitle: *"Your news, gathered from across the web and edited into one paper every morning, just for you."*
- Three small columns: "Tell us what you care about" / "We edit your paper every morning" / "It learns what you actually read".
- Buttons: **Start my paper** (→ `/signup`) and **Log in**.

### 8.4 Onboarding `/onboarding` (4 steps, one page, client component)

A thin progress bar at the top; Back/Next buttons; Enter key moves forward.

**Step 1 — Name your paper.**
Inputs: "What should we call you?" (prefilled from `display_name`) and "Name your paper" (placeholder `The {Name} Chronicle`, three suggestion chips: *The {Name} Times*, *The Daily {Name}*, *{Name}'s Morning Post*). Below, a **live masthead preview** that updates as they type. This is the "delight" moment of the demo.

**Step 2 — What do you care about?**
Grid of the 15 topic chips with lucide icons. Tap once = **Interested** (outlined, weight 1.0). Tap twice = **Love it** (filled red, weight 2.0, small star). Tap a third time = off. Helper text: *"Tap twice for the things you love."* Minimum 3 topics to continue.

**Step 3 — Anything specific?**
A text input that turns each entry into a removable chip on Enter (max 8, max 40 chars each). Suggestion chips depend on the topics picked, for example AI → *"LLM agents"*, *"OpenAI"*; Cricket → *"Pakistan cricket team"*, *"PSL"*; Pakistan → *"Pakistan economy"*, *"Islamabad"*. Optional step: "Skip" is allowed.

**Step 4 — How do you like to read?**
Three large option cards: **Quick** (8 stories, a line or two each, "5-minute read"), **Balanced** (11 stories, "10-minute read"), **Deep** (14 stories, fuller summaries, "20-minute read"). Then region: **Pakistan first / Global / Both**.

**Finish:**
1. Update `profiles` (display_name, paper_name, reading_style, region, onboarded=true).
2. Insert interests: one row per topic (`kind='topic'`, base_weight and weight = 1.0 or 2.0) and one per custom phrase (`topic='custom:<phrase>'`, `kind='custom'`, base_weight 1.5).
3. Call `POST /api/generate`, then go to `/today`, which shows the printing screen.

### 8.5 Printing screen (`PrintingScreen.tsx`)

Shown when the edition's status is `generating`. Full-page newsprint background, the reader's masthead at the top, a simple animated "press" (lines of text appearing one by one, or a rotating ink roller made with CSS), and the current `progress` text from the DB, polled every 2 s. If status becomes `failed`, show *"The press jammed. Let's try again."* with a **Try again** button (calls generate with `force: true`). Expect 20–60 seconds; the animation must make the wait feel intentional.

### 8.6 The front page `/today` and `/paper/[date]`

The paper **opens as the front page of a daily newspaper**. It is the place to scan, not to read: headlines, one-line deks, small bylines, nothing else. The reading happens on the story page (8.7). This split is what lets the product learn: which headlines the reader picks out of the whole front page, and how long they then stay, are the two strongest interest signals we have.

Both routes render the same `<FrontPage edition={...} />` component. `lib/edition.ts → loadEdition(userId, date)` queries `editions` + `edition_items` joined with `articles` and returns the Section 5.2 shape.

**What the front page shows per story — and nothing more:**

| Element | Lead | Feature | Standard | Brief |
|---|---|---|---|---|
| Headline | ✓ (48–64 px) | ✓ (26–30 px) | ✓ (18–20 px) | ✓ (15 px, one line) |
| Dek (one-line teaser) | ✓ | ✓ | ✓ (desktop only) | — |
| Image | ✓ if present | small, if present | — | — |
| Byline `SOURCE · 3h ago` | ✓ | ✓ | ✓ | — |
| Section kicker (tiny red label above the headline, e.g. `TECHNOLOGY`) | ✓ | ✓ | ✓ | — |
| Summary, key points, why-this, buttons | **never on the front page** | | | |

**Desktop layout (a broadsheet grid, 12 columns, max width ~1280 px):**

```
┌──────────────────────────────────────────────────────────────────────┐
│ ear: "3 stories picked for you"   THE SAAD CHRONICLE   ear: weather* │
│ ════════════════════════════════════════════════════════════════════ │
│ VOL. 1 · NO. 3     Saturday, 17 October 2026     PREPARED FOR SAAD   │
│ ──────────────────────────────────────────────────────────────────── │
│ INSIDE: Technology · AI · Cricket · Pakistan · Explore   [PDF] [⋯]   │
├────────────────────────────────────────────┬─────────────────────────┤
│ TECHNOLOGY                                 │ FROM THE EDITOR         │
│ LEAD HEADLINE IN VERY LARGE SERIF          │ short note (3–4 lines)  │
│ ACROSS EIGHT COLUMNS                       │─────────────────────────│
│ dek in italic, one line                    │ THREE THINGS TO KNOW    │
│ [image]                       SOURCE · 2h  │ 1. … 2. … 3. …          │
├──────────────┬──────────────┬──────────────┼─────────────────────────┤
│ FEATURE      │ FEATURE      │ STANDARD     │ IN BRIEF                │
│ headline     │ headline     │ headline     │ · headline              │
│ dek          │ dek          │ dek          │ · headline              │
│ byline       │ byline       │ ──────────── │ · headline              │
│              │              │ STANDARD     │                         │
├──────────────┴──────────────┴──────────────┴─────────────────────────┤
│ EXPLORE — SOMETHING NEW: headline · headline   (thin dashed box)     │
└──────────────────────────────────────────────────────────────────────┘
* weather ear is optional/cut-able; otherwise show the edition's story count.
```

Rules for the layout:

- Thin vertical rules between columns and thin horizontal rules between stories (CSS borders, 1 px ink). No cards, no shadows, no rounded corners.
- Text is left-aligned, headlines in Playfair Display bold with tight leading (1.05–1.15), deks in Source Serif italic, kickers and bylines in Inter uppercase 11 px with wide letter spacing.
- The whole front page should fit in about **1.5 screens** on a laptop for a Balanced edition. If it is longer, drop deks from standard items first.
- The **whole headline block is the link** (headline + dek + image), cursor pointer, hover: headline gets a 1 px underline in the accent red. Keyboard accessible (`<Link>` elements, visible focus ring).
- Already-opened stories get a small muted `READ` tag next to the byline, like a visited link, so the reader sees their progress.
- The **INSIDE** strip lists the sections in order; clicking one scrolls to it.
- The only controls on the front page: **Download PDF**, and a `⋯` menu with **Archive**, **Your interests**, **Regenerate**, **Log out**. Keep them small and in the masthead line.
- **Skip from the front page:** on hover (desktop) a tiny `×` appears at the top-right of a story with tooltip *"Not for me"*. It logs `skip` and fades the story to 30% opacity with *"Skipped · Undo"*. On mobile, skip lives only on the story page.
- If `ai_status = 'fallback'`: one slim line under the masthead *"Today's edition was put together without the AI editor; summaries come straight from the sources."*
- Footer: *"That's your paper for today. See you tomorrow morning."*

**Mobile (< 768 px):** masthead 36 px, info line wraps to two lines, INSIDE strip scrolls horizontally, then: lead (with image), Editor's Note collapsed to two lines with "more", Three Things, then every story as headline + dek + byline in one column, Briefs as a list, Explore last. Sticky bottom bar with **Download PDF**.

### 8.7 The story page `/paper/[date]/story/[itemId]`

Opens when the reader clicks a headline. A **real route** (not a modal), so the browser Back button returns to the front page, the URL is shareable, and the time spent on it is easy to measure.

**Navigation into it:**

1. On click, log `open` immediately (fire-and-forget), then `router.push` to the story URL.
2. Remember the front page scroll position in `sessionStorage` (inside try/catch) and restore it when the reader comes back, so returning feels like turning back to page one.

**Layout (single reading column, max width ~680 px, centred, generous margins):**

```
‹ Back to the front page                         THE SAAD CHRONICLE · 17 Oct
──────────────────────────────────────────────────────────────────────────
TECHNOLOGY                                      (kicker, accent red)
Headline in large serif
Dek in italic
THE VERGE · 2 HOURS AGO                         (byline)
[image, if present]

Summary paragraph (Source Serif, 19–20 px, line-height 1.6)

KEY POINTS
•  point one
•  point two

┌ Why you're seeing this ─────────────────────────────────────────────┐
│ You follow AI and spent several minutes on two similar stories.     │
└─────────────────────────────────────────────────────────────────────┘

[ Read the full story at The Verge ↗ ]        (primary button, accent red)

Was this worth your time?   [👍 More like this]  [👎 Less like this]  [Not for me]

──────────────────────────────────────────────────────────────────────────
NEXT IN TECHNOLOGY                 MORE FROM TODAY'S PAPER
headline →                         headline → · headline →
```

- **Read the full story** → logs `click_through`, opens the original in a new tab (`target="_blank" rel="noopener noreferrer"`). The read timer keeps running only while this tab is visible, so time on the original site is not counted.
- **👍 / 👎** → logs `like` / `dislike`, selected state, small toast *"Got it — more like this"* / *"Got it — less like this"*.
- **Not for me** → logs `skip`, toast *"We'll show you less of this"*, then returns to the front page.
- **Next in [section]** and **More from today's paper** (2–3 other headlines from the same edition, not yet read) keep the reader moving between stories; each click is a new `open`.
- Keyboard: `←` back to front page, `→` next story.
- Honest content note in small muted text under the summary: *"Summary based on the publisher's preview. Read the full story for everything."*

**Reading-time tracking — `lib/useReadTimer.ts`:**

```ts
export function useReadTimer(item: { editionId: string; itemId: string; topic: string|null; sourceName: string|null }): void
```

How it works (implement exactly this — it keeps the signal honest):

1. Start a 1-second interval when the story page mounts.
2. Each tick adds 1 to `activeSeconds` **only if** `document.visibilityState === 'visible'` **and** the last user activity (`scroll`, `mousemove`, `keydown`, `touchstart`, `wheel` — throttled listeners) was less than 30 seconds ago.
3. Send **one** `read_time` event with `value = min(activeSeconds, 600)` when the reader leaves, whichever happens first:
   - component unmount (Back, Next story, any in-app navigation),
   - `pagehide` (tab closed or browser navigates away),
   - `visibilitychange` to `hidden` lasting longer than 60 seconds (then a later return starts a fresh visit only if they come back via a new `open`).
4. Use a `sent` ref so it is never sent twice. If `activeSeconds` is 0, send nothing.
5. Send through `POST /api/events` with `fetch(..., { keepalive: true })` (or `navigator.sendBeacon`), because a normal Supabase insert can be cancelled when the page is closing.

**`lib/events.ts`:**

```ts
type EventType = 'open'|'read_time'|'click_through'|'like'|'dislike'|'skip'|'quiz_correct'|'quiz_wrong';

export function logEvent(e: {
  editionId: string; itemId: string; topic: string | null; sourceName: string | null;
  type: EventType; value?: number;
}): void
// fire-and-forget: POST /api/events with keepalive; swallows all errors; never blocks or throws to the UI
```

All events go through this one helper and the one API route, so the browser never needs the user id and there is a single place to validate.

### 8.8 Next.js API routes

**`POST /api/generate`** body `{ force?: boolean }`:
1. Get the user from the server Supabase client; 401 if none.
2. `fetch(ENGINE_URL + '/editions/generate', { method: 'POST', headers: { 'X-Service-Key': SERVICE_SHARED_SECRET, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, force }) })`.
3. Return the engine's JSON. If the engine is unreachable, return 503 with `{ error: 'engine_unavailable' }` and the UI shows *"The printing press is warming up — try again in a minute."*

**`POST /api/events`** body `{ editionId, itemId, topic, sourceName, type, value? }`:
1. Get the user from the server Supabase client; 401 if none (silently ignored by the client).
2. Validate: `type` is one of the Section 5.3 types; `value` only for `read_time`, a number clamped to 0–600; ids are UUID strings.
3. Insert into `public.events` with the **user's** Supabase client (RLS `insert own events` is the guard) and `user_id = user.id`. Return `204`.
4. Never return error details to the browser.

**`GET /api/pdf/[editionId]`**:
1. Get the user; 401 if none.
2. Confirm with the user's Supabase client that the edition exists (RLS guarantees ownership); 404 otherwise.
3. Fetch the engine PDF with the service key and stream it back with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="morning-edition-YYYY-MM-DD.pdf"`.

### 8.9 Archive `/archive`

A list styled like a newspaper rack: one row per edition (newest first) showing the date, `No. N`, the lead headline, story count, and two links: **Read** (`/paper/YYYY-MM-DD`) and **PDF**. Empty state: *"Your first paper is being printed. Come back tomorrow for the next one."*

### 8.10 "What your paper knows about you" `/interests`

The learning feature made visible (important for the demo):

- Horizontal bars for every interest, sorted by weight, with the change since the last edition (`weight − previous_weight`) shown as ▲ +0.4 / ▼ −0.2.
- Badges: **Picked by you** (topic), **Your phrase** (custom), **Learned from your reading** (learned).
- **Reading stats** (from events): stories opened this week, **total reading time**, average time per story, most-read section, most-read source, likes and skips. Plus a per-topic line, e.g. *"AI — 6 stories opened, 14 min read"*.
- Controls: remove an interest, change Interested/Love it, add a new phrase. Saving updates `interests.base_weight`.
- A line of explanation: *"Your paper adjusts these every morning based on which headlines you open, how long you actually read, and what you like or skip."*

### 8.11 Daily freshness

- **Lazy:** opening `/today` with no edition for today triggers generation (already covered).
- **Optional (only if time remains):** a Vercel Cron job (`vercel.json`, once per day at 00:00 UTC = 5 AM in Pakistan) calling `/api/cron` with a secret, which calls the engine for all onboarded users.

---

## 9. Creative Features ("Room to Explore")

Do these in this order and only after the core works.

1. **Three Things You Learned Today** *(core, already in the AI call)* — box on the front page (web and PDF). It answers the problem statement directly: *"people can't name three things they learned."*
2. **Why you're seeing this** *(core)* — transparency on every story.
3. **Explore stories** *(core)* — 1–2 stories a day from outside the reader's topics; liking one creates a "learned" interest. This shows the paper growing with the reader.
4. **Read me the front page** *(stretch, ~20 min)* — a button that reads the editor's note, the front-page headlines and the Three Things aloud (and on a story page, that story's summary) with the browser's built-in `speechSynthesis` API. No API cost.
5. **Morning quiz** *(stretch, ~40 min)* — after the Three Things, a "Test yourself" button generating 3 multiple-choice questions from today's Three Things (one extra OpenRouter call through a new engine route `POST /editions/{id}/quiz`). Logs `quiz_correct`/`quiz_wrong`.

---

## 10. Build Plan — Step by Step

Times are relative to the start (T+0:00). **PRO** = the Pro account running Claude Code in VS Code. **SIDE-A/B/C/D** = other accounts producing standalone files that get pasted in. Side tasks only need Sections 1, 5 and their own section of this file.

| Step | Who | Time box | Starts |
|---|---|---|---|
| 0. Manual setup | You | 20 min | T+0:00 |
| 1. Scaffold repo, schema, env | PRO | 25 min | T+0:20 |
| 2. Sample edition + PDF renderer | SIDE-A | 60 min | T+0:20 |
| 3. Source catalogue + verify script | SIDE-B | 30 min | T+0:20 |
| 4. Onboarding UI | SIDE-C | 60 min | T+0:20 |
| 5. Engine core pipeline | PRO | 70 min | T+0:45 |
| 6. Auth, middleware, onboarding wiring | PRO | 40 min | T+1:55 |
| 7. Front page, story page, read tracking | PRO | 75 min | T+2:35 |
| 8. PDF integration + archive | PRO | 30 min | T+3:50 |
| 9. Learning + interests page | PRO | 35 min | T+4:20 |
| 10. Deploy | PRO + You | 30 min | T+4:55 |
| 11. Diagram, README, Loom script | SIDE-D | 40 min | anytime after T+2:00 |
| 12. Polish + stretch features | PRO | 20 min | T+5:25 |
| 13. Record Loom + submit | You | 30 min | T+5:45 |

**Commit after every step** with a clear message. The judges watch the commits.

---

### Step 0 — Manual setup (You, 20 min)

1. Create a **public** GitHub repo `morning-paper`, clone it, add this `SPEC.md`, commit `docs: add project spec`, push.
2. Create a Supabase project (choose the region closest to you, e.g. Mumbai). Save the URL, anon/publishable key and service role/secret key.
3. Supabase → Authentication → Providers → Email: turn **off** "Confirm email".
4. Check OpenRouter with one request (Git Bash):
   ```bash
   curl https://openrouter.ai/api/v1/chat/completions \
     -H "Authorization: Bearer $OPENROUTER_API_KEY" -H "Content-Type: application/json" \
     -d '{"model":"YOUR_MODEL","messages":[{"role":"user","content":"Reply with {\"ok\":true} only"}],"response_format":{"type":"json_object"}}'
   ```
   Pick a **fast, cheap model that returns clean JSON**. Write its id into `OPENROUTER_MODEL`.
5. Make sure you are logged in to Vercel and Render with GitHub.
6. Generate the shared secret: `python -c "import secrets; print(secrets.token_urlsafe(32))"`.
7. Give SIDE-A, SIDE-B and SIDE-C their prompts (they start now, in parallel).

**Done when:** repo exists, Supabase is ready, an OpenRouter call returned JSON.

### Step 1 — Scaffold (PRO, 25 min)

1. Create the folder structure in Section 3 (empty modules with docstrings are fine).
2. `engine/`: `requirements.txt`, `.env.example`, `config.py`, `main.py` with `/health` only.
3. `web/`: `npx create-next-app@latest web --ts --tailwind --app --eslint --src-dir=false --import-alias "@/*"`, install `@supabase/supabase-js @supabase/ssr lucide-react`, set up fonts (Section 8.1), `lib/supabase/client.ts` and `server.ts`, `.env.example`.
4. Write `supabase/schema.sql` exactly as Section 6. **You** paste and run it in the Supabase SQL editor.
5. Root `.gitignore` (Section 4.3).

**Done when:** `uvicorn main:app --reload` answers `/health`; `npm run dev` shows the default page; tables exist in Supabase.
**Commit:** `chore: scaffold engine, web and database schema`

### Step 2 — Sample edition + PDF renderer (SIDE-A, 60 min)

Inputs: Sections 1, 5.2, 7.10.
Outputs: `engine/samples/sample_edition.json` (realistic, 4–5 sections, 12 items, every item with `dek` and 0–3 `key_points`, one with `&` and `<` in the text, half without images), `engine/pdf/render.py`, the list of DejaVu font files to download into `engine/pdf/fonts/`, and `engine/tests/test_pdf.py`.

**Done when:** `python -m pdf.render samples/sample_edition.json out.pdf` produces a newspaper-style PDF: page 1 is a front page of headlines and deks that fits on one page; pages 2–3 hold the full stories.
**Commit (when pasted in):** `feat(pdf): newspaper-style edition renderer`

### Step 3 — Source catalogue (SIDE-B, 30 min)

Inputs: Sections 5.1, 7.2.
Output: `engine/sources.py` with `TOPICS`, `EXPLORE_POOL`, `google_news_rss()`, and a `--verify` mode.
**You** run `python -m sources --verify` and delete any feed that fails.

**Commit:** `feat(engine): topic and feed catalogue`

### Step 4 — Onboarding UI (SIDE-C, 60 min)

Inputs: Sections 5.1, 8.1, 8.4.
Output: `web/lib/topics.ts` and `web/components/onboarding/*` (StepName, StepTopics, StepSpecific, StepStyle, MastheadPreview, ProgressBar) plus `web/app/onboarding/page.tsx`. The page collects all answers into one state object:

```ts
type OnboardingAnswers = {
  displayName: string; paperName: string;
  topics: { slug: string; label: string; level: 1 | 2 }[];
  customPhrases: string[];
  readingStyle: 'quick' | 'balanced' | 'deep';
  region: 'pakistan' | 'global' | 'both';
};
```

and calls a single `onFinish(answers)` prop or function **that PRO will implement** in Step 6.

**Commit:** `feat(web): onboarding flow UI`

### Step 5 — Engine core pipeline (PRO, 70 min)

Implement Sections 7.1, 7.3–7.9 in this order: `db.py` → `fetcher.py` → `ranking.py` → `learning.py` → `prompts.py` → `ai_editor.py` → `edition_builder.py` → routes in `main.py`. Paste in SIDE-B's `sources.py` first.

Testing without the web app: create a test user in Supabase (Authentication → Add user), insert 3 interests for them manually, then:

```bash
curl -X POST localhost:8000/editions/generate -H "X-Service-Key: $SECRET" \
  -H "Content-Type: application/json" -d '{"user_id":"<uuid>"}'
```

Check that `editions` turns `ready` and `edition_items` has rows. Then set a wrong `OPENROUTER_MODEL` and confirm the edition is still produced with `ai_status = 'fallback'`.

**Done when:** both the AI path and the fallback path produce a ready edition; `pytest` passes.
**Commits:** `feat(engine): feed fetching and ranking`, `feat(engine): AI editor with validation and fallback`, `feat(engine): edition generation API`

### Step 6 — Auth + onboarding wiring (PRO, 40 min)

Sections 8.2, 8.3, 8.4 (finish logic). Paste in SIDE-C's onboarding files and implement `onFinish`. Build `/login`, `/signup`, `/`, `middleware.ts`, `POST /api/generate`.

**Done when:** a brand-new user can sign up → onboard → land on `/today` (even if `/today` is a placeholder) and an edition is generating in the DB.
**Commit:** `feat(web): auth, landing and onboarding`

### Step 7 — Front page, story page, read tracking (PRO, 75 min)

Sections 8.5, 8.6, 8.7, 8.8 (`/api/events`). Build in this order:

1. `FrontPage` + `Masthead` + `HeadlineBlock` + `BriefsColumn` + `EditorsNote` + `ThreeThings`, first using `engine/samples/sample_edition.json` as a fixture. Get the broadsheet look right before wiring data — it is the first thing judges see.
2. The story page route + `StoryView` + `MoreStories`.
3. `POST /api/events`, `lib/events.ts`, `lib/useReadTimer.ts`.
4. `PrintingScreen`, then switch from the fixture to real data via `lib/edition.ts`.

**Test the tracking by hand:** open a story, read for ~40 s, press Back → an `open` row and a `read_time` row with value ≈ 40 appear in `events`. Open a story, switch to another tab for 2 minutes, come back, press Back → the `read_time` value must **not** include those 2 minutes.

**Done when:** the front page looks like a newspaper on desktop and mobile; headlines open story pages; open, read_time, click_through, like, dislike and skip all write correct rows; READ tags appear on opened stories; Back restores the front page scroll position.
**Commit:** `feat(web): front page, story pages and reading-time tracking`

### Step 8 — PDF integration + archive (PRO, 30 min)

Paste SIDE-A's renderer if not done. Wire `GET /editions/{id}/pdf` in the engine and `GET /api/pdf/[editionId]` in Next. Build `/archive` and `/paper/[date]` (Section 8.8).

**Done when:** **Download PDF** downloads the same edition shown on screen; old editions open from the archive.
**Commit:** `feat: PDF download and edition archive`

### Step 9 — Learning made visible (PRO, 35 min)

Section 8.9. Confirm learning works end to end: open 3 AI stories and read each for 30+ seconds, like one, and skip 3 sports stories → **Regenerate** → the AI section moves up and sports moves down; `/interests` shows ▲/▼ changes. Add the **Regenerate** button flow (`force: true` → printing screen).

**Commit:** `feat: interest learning and transparency page`

### Step 10 — Deploy (PRO + You, 30 min)

1. **Render:** New Web Service from the repo, root directory `engine`, build `pip install -r requirements.txt`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`, add env vars. Confirm `/health`.
2. **Vercel:** import the repo, root directory `web`, add env vars with `ENGINE_URL` = the Render URL.
3. **Supabase:** Authentication → URL configuration → set Site URL to the Vercel URL.
4. Set `APP_PUBLIC_URL` on Render to the Vercel URL.
5. Full test on the live URL with a fresh account.

> Render's free tier sleeps after about 15 minutes idle and the first request can take up to a minute. **Open `/health` a few minutes before recording the Loom.**

**Commit:** `chore: deployment config`

### Step 11 — Diagram, README, Loom script (SIDE-D, 40 min)

Inputs: Sections 0, 2, 3, 9 of this file.
Outputs: `docs/architecture.md` (mermaid + a half-page explanation of each component and the learning loop), a clean exported diagram image (render the mermaid at mermaid.live and export PNG → `docs/architecture.png`), `README.md` (purpose, features, architecture image, setup for engine and web, env vars with placeholders, how learning works, how AI failure is handled), and the 5-minute Loom script (Section 13).

**Commit:** `docs: architecture diagram and README`

### Step 12 — Polish + stretch (PRO, 25 min)

In this order, stop when time runs out: empty/error states everywhere → mobile check → favicon + page titles → "Read me the front page" → quiz.

**Commit:** `feat: polish and read-aloud`

### Step 13 — Record and submit (You, 30 min)

Warm up Render. Create a fresh demo account. Record (Section 13). Submit the repo link, Loom link and diagram via the form.

---

## 11. Error Handling Summary

| Situation | What happens |
|---|---|
| A feed fails or times out | Skipped silently; other feeds still used; Google News query covers the topic. |
| All feeds for a topic fail | That topic just has fewer stories. |
| Fewer than 20 candidates | Age window widens from 36 h to 72 h. |
| OpenRouter key missing / invalid / rate limited / timeout | One retry, then local fallback edition (`ai_status = 'fallback'`) with a slim notice on the page. |
| AI returns invalid JSON or wrong ids | Parser + validator repair what they can; otherwise fallback. |
| Engine asleep or down | Next.js returns 503; UI shows "printing press warming up" with Try again. |
| Unexpected engine exception | Edition `status = 'failed'`; printing screen shows Try again. |
| PDF image download fails | Image skipped. |
| Event insert fails | Ignored silently; never blocks reading. |

No stack traces, keys or raw API responses are ever shown to users or stored.

---

## 12. Final Acceptance Checklist

1. A new user can sign up, onboard in under a minute, and receive a paper.
2. The paper reflects onboarding answers (topics, custom phrases, reading style, region).
3. Today's paper opens as a newspaper front page (headlines and deks only) on desktop and mobile; clicking a headline opens the story page.
4. Every story links to the original article.
5. Stories can be liked, disliked and skipped.
6. The same edition downloads as a newspaper-style PDF with clickable headlines.
7. Previous editions are listed in the archive and open on the web and as PDF.
8. Opens, active reading time, likes, dislikes and skips change topic weights, visible on `/interests` (with reading-time stats), and a regenerated paper reflects them. Reading time counts only active, visible time.
9. Every story says why it was chosen.
10. Three Things You Learned appears on the web and in the PDF.
11. Explore stories appear and can become learned interests.
12. With a broken OpenRouter config, a paper is still produced.
13. No secrets in the repo, the browser, the DB or logs.
14. The app is live on a public URL.
15. The repo is public with steady, meaningful commits.
16. The architecture diagram, README and Loom are submitted.

---

## 13. Loom Script (5 minutes max)

| Time | Show | Say (roughly) |
|---|---|---|
| 0:00–0:25 | Landing page | The problem: news is scattered, and people can't name three things they learned. This is a personal morning paper. |
| 0:25–1:15 | Sign up + onboarding | Name the paper (live masthead), tap topics (twice for love), add "Pakistan cricket team", choose Balanced + Both. |
| 1:15–1:35 | Printing screen | The engine gathers stories from dozens of feeds, ranks them, and one AI editor call writes the paper. |
| 1:35–2:35 | Front page → story | Scan the front page like a real paper. Click a headline → story page: summary, key points, why-this. Read a bit, like it, go Back (READ tag appears). Skip one from the front page. Say: the paper is timing what you actually read. |
| 2:35–3:10 | Download PDF | Open the PDF: masthead, columns, clickable headlines, Three Things box. |
| 3:10–3:50 | Learning | `/interests`: weights, ▲/▼ changes, reading-time stats per topic. Regenerate → the topic you read longest moves up. |
| 3:50–4:10 | Archive | Previous editions, web and PDF. |
| 4:10–4:45 | Architecture diagram | Next.js + Supabase + Python engine + OpenRouter; RLS; secrets only on servers; fallback when AI fails. |
| 4:45–5:00 | Close | What's next: morning email delivery, audio edition, smarter learning. |

Before recording: warm the engine, use a clean account, close unrelated tabs, zoom the browser to 110%.

---

## 14. Cut List (use when behind schedule)

Cut from the top first:

1. Quiz.
2. Read-aloud.
3. Vercel cron (lazy generation is enough).
4. The activity check inside the read timer (keep visibility-only timing).
5. "More from today's paper" on the story page (keep "Next in section").
6. Images in the PDF.
7. Editing interests on `/interests` (keep it read-only).
8. Region option in onboarding (default `both`).
9. Near-duplicate title detection (keep exact URL dedupe).

**Never cut:** onboarding, the front page → story page flow, open + read-time tracking, the PDF, the archive, visible learning, the AI fallback, deployment.
