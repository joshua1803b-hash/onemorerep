-- Supabase schema for the Program Pack architecture (single-user sync).
--
-- These two tables back the exercise catalog + swappable program packs so an
-- external writer (the MCP server) can publish a plan and the app reads it.
-- They MUST match the table/column names the MCP server writes to exactly.
--
-- RLS posture: these tables should share the SAME RLS posture as the existing
-- tables (workout_log, progression_state, program, exercise_library), which
-- already allow the Supabase anon key to read/write directly from the browser.
-- This app is single-user, so there is no per-user auth in code.
--
-- This file does NOT assume a specific RLS state (enabled vs. disabled). If your
-- existing tables have RLS disabled, leave these the same. If RLS is enabled
-- with permissive anon policies, mirror that by uncommenting the policy blocks
-- below (adjust to match how your existing tables are configured).

create table if not exists exercise_catalog (
  canonical_id text primary key,
  display_name text not null,
  aliases jsonb default '[]',
  muscle_group text,
  movement_type text,
  equipment text,
  default_increment_kg numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists program_pack (
  pack_id text primary key,
  version int default 1,
  name text not null,
  source jsonb,
  progression_rules jsonb,
  sessions jsonb not null,
  is_active boolean default false,
  updated_at timestamptz default now()
);

-- Optional: permissive anon policies (uncomment ONLY if your existing tables
-- use RLS with anon read/write policies, and match their exact posture).
--
-- alter table exercise_catalog enable row level security;
-- alter table program_pack enable row level security;
--
-- create policy "anon read exercise_catalog"  on exercise_catalog for select using (true);
-- create policy "anon write exercise_catalog" on exercise_catalog for insert with check (true);
-- create policy "anon update exercise_catalog" on exercise_catalog for update using (true) with check (true);
--
-- create policy "anon read program_pack"  on program_pack for select using (true);
-- create policy "anon write program_pack" on program_pack for insert with check (true);
-- create policy "anon update program_pack" on program_pack for update using (true) with check (true);
