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
