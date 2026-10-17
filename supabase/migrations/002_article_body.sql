-- Run once in the Supabase SQL editor if your database was created from an older schema.sql.
-- Adds the full article text so stories can be read on the site itself.
alter table public.articles add column if not exists body text;
alter table public.articles add column if not exists author text;
alter table public.articles add column if not exists word_count int;
