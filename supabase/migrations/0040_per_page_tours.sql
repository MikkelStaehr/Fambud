-- Migration 0040: per-page tour-state.
--
-- Tidligere havde vi én enkelt tour_completed_at-timestamp på family_members
-- for dashboard-touren. Nu udvider vi til per-page tours: hver side i appen
-- kan have sin egen onboarding for first-time-visitors, og vi sporer hvilke
-- tours brugeren har set.
--
-- Datamodel: jsonb-objekt {tourKey: ISO-timestamp}, fx
--   {"dashboard": "2026-05-02T14:23:00Z", "opsparinger": "2026-05-03T..."}
--
-- Vi migrerer eksisterende tour_completed_at-data ind i den nye kolonne under
-- 'dashboard'-key og dropper den gamle.

alter table public.family_members
  add column if not exists tours_completed jsonb not null default '{}'::jsonb;

comment on column public.family_members.tours_completed is
  'Per-page tour-completion timestamps. Format: {tourKey: ISO-timestamp}';

-- Migrér eksisterende tour_completed_at -> tours_completed.dashboard
update public.family_members
set tours_completed = jsonb_build_object('dashboard', to_jsonb(tour_completed_at))
where tour_completed_at is not null
  and tours_completed = '{}'::jsonb;

-- Drop den gamle single-timestamp-kolonne
alter table public.family_members
  drop column if exists tour_completed_at;
