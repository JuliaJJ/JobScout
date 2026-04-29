-- JobScout Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Job listings table
create table job_listings (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  url text not null,
  title text,
  company text,
  location text,
  raw_text text,
  parsed_skills jsonb default '[]',
  parsed_requirements jsonb default '[]',
  parsed_nice_to_haves jsonb default '[]',
  seniority_level text,
  role_cluster text, -- 'ux', 'design-engineer', 'design-technologist', 'product-design', 'other'
  interest_rating text check (interest_rating in ('yes', 'maybe', 'no')) default 'maybe',
  notes text,
  is_archived boolean default false
);

-- Resume table (single row, updated in place with versioning)
create table resume_versions (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  label text not null default 'Resume',
  content text not null,
  is_active boolean default true
);

-- Gap analyses table
create table gap_analyses (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  resume_version_id uuid references resume_versions(id),
  listing_count int,
  analysis_text text,
  skills_present jsonb default '[]',
  skills_missing jsonb default '[]',
  skills_partial jsonb default '[]',
  action_plan jsonb default '[]'
);

-- Skills aggregation view
create or replace view skills_aggregate as
select
  skill,
  count(*) as frequency,
  round(count(*) * 100.0 / (select count(*) from job_listings where interest_rating != 'no' and is_archived = false), 1) as pct_of_wanted_roles
from job_listings,
  jsonb_array_elements_text(parsed_skills) as skill
where interest_rating != 'no'
  and is_archived = false
group by skill
order by frequency desc;

-- RLS: disable for personal tool (single user)
alter table job_listings disable row level security;
alter table resume_versions disable row level security;
alter table gap_analyses disable row level security;
