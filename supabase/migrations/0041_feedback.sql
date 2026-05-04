-- Feedback fra test-brugere. Vi gemmer ALTID i DB (kilden) og sender
-- en notifikations-mail via Resend. Hvis Resend fejler/rate-limiter er
-- beskeden stadig sikkert i DB - så vi mister aldrig feedback.
--
-- Beskeden er åben for alle authenticated brugere. Læsning sker via
-- Supabase Dashboard (eller en senere admin-side); RLS tillader kun
-- INSERT, alt andet kræver service_role.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  household_id uuid references public.households(id) on delete set null,
  email text,
  full_name text,
  message text not null check (length(trim(message)) > 0),
  page_url text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index feedback_created_at_desc_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Authenticated brugere må kun indsætte feedback der peger på dem selv.
-- Det forhindrer en kompromiteret klient i at oprette feedback i andre
-- brugeres navn (selvom payload'en alligevel valideres serverside).
create policy "users insert own feedback"
  on public.feedback
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Ingen SELECT/UPDATE/DELETE-policies → default deny. Læsning sker via
-- Supabase Dashboard / service_role - bevidst, så brugere ikke kan
-- enumerate andres feedback.
