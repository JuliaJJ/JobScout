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

alter table rubric_audits disable row level security;
alter table rubric_self_scores disable row level security;
