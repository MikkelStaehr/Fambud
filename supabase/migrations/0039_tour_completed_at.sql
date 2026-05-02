-- Migration 0039: tour_completed_at på family_members.
--
-- Sporer om brugeren har gennemført den interaktive dashboard-tour
-- (spotlight + tooltips). Sat én gang når brugeren klikker "Færdig" eller
-- "Spring over". Genstart-knap i indstillinger nuller den tilbage.
--
-- NULL = tour ikke set endnu → auto-start ved næste dashboard-besøg.
-- Sat = tour set, vi spammer ikke brugeren igen.
--
-- Vi gemmer per-bruger (ikke per-husstand) fordi turen er en visuel
-- introduktion til UI'et. Hver person skal have deres egen mulighed
-- for at se den.

alter table public.family_members
  add column if not exists tour_completed_at timestamptz;

comment on column public.family_members.tour_completed_at is
  'Tidspunkt brugeren afsluttede dashboard-touren. NULL = endnu ikke set.';
