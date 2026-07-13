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
  application_status text check (application_status in ('applied', 'screening', 'interviewing', 'offer', 'closed')),
  applied_at timestamptz,
  salary_min integer, -- annual USD base
  salary_max integer, -- annual USD base
  cover_letter text,
  contacts jsonb default '[]', -- array of { id, name, role, email, linkedin, date, notes }
  notes text,
  is_archived boolean default false,
  resume_tailoring jsonb, -- { bullet_rewrites: [...], keywords: [...], coaching: [...] }
  fit_check jsonb default '{}' -- cached per-listing gap check: { generated_at, summary, skills_present, skills_partial, skills_from_portfolio, skills_missing }
);

-- Migration: add resume_tailoring and fit_check to existing job_listings tables
-- alter table job_listings add column if not exists resume_tailoring jsonb;
-- alter table job_listings add column if not exists fit_check jsonb default '{}';

-- Resume table (single row, updated in place with versioning)
create table resume_versions (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  label text not null default 'Resume',
  content text not null,
  is_active boolean default true,
  structured_data jsonb -- { summary, experience: [{id, title, company, location, startDate, endDate, current, bullets}], education, skills, certifications }
);

-- Migration: add structured_data to existing resume_versions tables
-- alter table resume_versions add column if not exists structured_data jsonb;

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
  skills_from_portfolio jsonb default '[]', -- array of { skill, portfolio_piece, resume_suggestion }
  action_plan jsonb default '[]'
);

-- Migration: add skills_from_portfolio to existing gap_analyses tables
-- alter table gap_analyses add column if not exists skills_from_portfolio jsonb default '[]';

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

-- Portfolio pieces table
create table portfolio_pieces (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  title text not null,
  type text default 'Project',
  description text,
  url text,
  role_clusters jsonb default '[]', -- subset of: ux, product-design, design-engineer, design-technologist
  skills jsonb default '[]',
  mdx_content text -- raw .mdx file content for case study uploads
);

-- Migration: add mdx_content to existing portfolio_pieces tables
-- alter table portfolio_pieces add column if not exists mdx_content text;

-- STAR story bank (reusable behavioral interview stories, not tied to a listing)
create table interview_stories (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  title text not null,
  situation text,
  task text,
  action text,
  result text,
  behavioral_tags jsonb default '[]' -- subset of: leadership, influence, ambiguity, conflict, impact, collaboration, feedback, failure
);

-- Per-listing interview prep
create table interview_prep (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  listing_id uuid references job_listings(id) not null,
  company_notes text,
  anticipated_questions jsonb default '[]', -- array of { id, question, category, notes }
  questions_to_ask jsonb default '[]', -- array of { id, question }
  suggested_story_tags jsonb default '[]' -- subset of interview_stories.behavioral_tags vocabulary, ranked by relevance to this listing
);

-- Migration: add suggested_story_tags to existing interview_prep tables
-- alter table interview_prep add column if not exists suggested_story_tags jsonb default '[]';

-- Per-listing offer details (only relevant once application_status = 'offer')
create table offer_details (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  listing_id uuid references job_listings(id) not null,
  base_salary integer,
  equity text,
  bonus text,
  remote_policy text,
  pto text,
  benefits text,
  score int, -- 1-5 star overall rating
  notes text
);

-- RLS: disable for personal tool (single user)
alter table job_listings disable row level security;
alter table resume_versions disable row level security;
alter table gap_analyses disable row level security;
alter table portfolio_pieces disable row level security;
alter table interview_stories disable row level security;
alter table interview_prep disable row level security;
alter table offer_details disable row level security;
