-- JobScout migration: rubric audit (2026-10-22)
-- Run once in the Supabase SQL editor on an existing JobScout database.
-- Safe to re-run.

alter table profile add column if not exists portfolio_url text;
alter table portfolio_pieces add column if not exists featured boolean default false;

create table if not exists rubric_audits (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  rubric_version text not null,
  scope text check (scope in ('general', 'listing')) default 'general',
  listing_id uuid references job_listings(id) on delete set null,
  resume_version_id uuid references resume_versions(id) on delete set null,
  portfolio_url text,
  featured_piece_ids jsonb default '[]',
  scores jsonb default '{}',
  weights jsonb default '{}',
  psi jsonb,
  points int,
  max_points int,
  errors jsonb default '[]'
);

create table if not exists rubric_self_scores (
  criterion_id text primary key,
  updated_at timestamptz default now(),
  score int check (score between 0 and 2),
  notes text
);

-- Access: JobScout is a single-user app that talks to Supabase with the anon key.
-- Newer Supabase projects switch row-level security on for new tables automatically,
-- which blocks inserts. Instead of turning RLS off, keep it on and add a policy that
-- gives the app the same open access the other JobScout tables have.
alter table rubric_audits enable row level security;
alter table rubric_self_scores enable row level security;

drop policy if exists "jobscout app access" on rubric_audits;
create policy "jobscout app access" on rubric_audits
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "jobscout app access" on rubric_self_scores;
create policy "jobscout app access" on rubric_self_scores
  for all to anon, authenticated using (true) with check (true);
