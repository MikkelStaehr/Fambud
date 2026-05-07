-- ============================================================================
-- 0057 - Landing-flow submissions: anonyme svar fra "Find ud af det selv"
-- ----------------------------------------------------------------------------
-- Når en besøgende rammer Step 3 i landingflow'et på fambud.dk, gemmer vi
-- deres state (brikker, tre tal, begivenheder) sammen med en anonym token.
-- Tokenen bæres i besøgerens localStorage og bliver linket til en bruger
-- via link_landing_submission() når personen senere opretter en konto.
--
-- Ingen email, ingen IP-i-klartekst, ingen direkte PII. Vi gemmer en
-- sha256-hash af IP'en for at kunne de-dupe og finde misbrug, men den er
-- ikke reversibel.
--
-- Mål: kunne måle conversion rate (rammer flow → opretter bruger) +
-- segmentere på flow-state ("brugere der valgte system='none' konverterer
-- 2x højere end 'sheet'-brugere"). Læsning sker via service-role i
-- Supabase Dashboard - ingen authenticated/anon har SELECT-adgang.
-- ============================================================================

create table landing_flow_submissions (
  id uuid primary key default gen_random_uuid(),

  -- Anonym token genereret i browseren (uuid v4) og lagret i localStorage.
  -- Når brugeren kommer til /signup, sendes samme token med, og
  -- link_landing_submission() sætter converted_user_id på rækken.
  anonymous_token uuid not null,

  -- Hele flow-state som JSON (brikker, indkomst, faste, husholdning,
  -- unsureFields, householdAtZero, upcomingEvents). Vi gemmer det som
  -- jsonb så vi kan querye på fx "submissions hvor brikker indeholder
  -- 'buffer'" uden ekstra schema-arbejde.
  flow_state jsonb not null,

  -- IP-hash + user-agent til misbrugs-detektion. Ikke til marketing.
  -- IP gemmes som sha256-hash så GDPR-PII er minimeret.
  ip_hash text,
  user_agent text,

  submitted_at timestamptz not null default now(),

  -- Konverterings-link. NULL indtil brugeren matcher sin token under
  -- signup. converted_user_id på auth.users så cascade-delete renser
  -- linket når brugeren slettes (vi mister conversion-fakta, men det er
  -- den rigtige privacy-default).
  converted_user_id uuid references auth.users(id) on delete set null,
  converted_at timestamptz
);

-- Token-index: hovedopslagsvejen ved signup.
create index landing_flow_submissions_token_idx
  on landing_flow_submissions(anonymous_token);

-- Tidsbaseret index: "hvor mange submissions sidste 7 dage?" osv.
create index landing_flow_submissions_submitted_at_idx
  on landing_flow_submissions(submitted_at desc);

-- Partial index på konverterede - de fleste rækker konverterer ikke,
-- så det her holder index'et lille.
create index landing_flow_submissions_converted_idx
  on landing_flow_submissions(converted_at)
  where converted_at is not null;

-- ----------------------------------------------------------------------------
-- RLS: stort set lukket. INSERT for anyone (landing er offentlig).
-- SELECT/UPDATE/DELETE udelukkende via service-role (Supabase Dashboard
-- eller link_landing_submission-funktionen nedenfor).
-- ----------------------------------------------------------------------------
alter table landing_flow_submissions enable row level security;

-- INSERT-policy: alle (anon + authenticated) kan indsætte. Ingen
-- with check-betingelse - rækken er anonym, så der er intet at validere
-- på row-niveau. Misbrug håndteres via rate-limit i serverside-actionen.
create policy "anyone insert landing_flow_submissions"
  on landing_flow_submissions for insert
  to anon, authenticated
  with check (true);

-- Ingen SELECT/UPDATE/DELETE-policies → default deny.

-- Lås base-table-grants: selv uden RLS-policy kan PostgreSQL grants
-- give selv-skadende access. Drop alle grants og giv kun INSERT tilbage.
revoke all on landing_flow_submissions from authenticated, anon;
grant insert on landing_flow_submissions to authenticated, anon;

-- ----------------------------------------------------------------------------
-- link_landing_submission(p_token uuid)
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER-funktion der lader nylig signed-up bruger linke deres
-- egen anonyme submission. Funktionen er minimal i blast-radius:
--   * Sætter kun converted_user_id og converted_at
--   * Kun rækker med matching token OG converted_user_id IS NULL
--     (idempotent + uoverskrivelig)
--   * Bruger auth.uid() så brugeren kun kan linke til SIG SELV
--
-- Returnerer void - selv hvis tokenen ikke findes (eller allerede er
-- konverteret), er det ikke en fejl. Det er en best-effort attribuering.
create or replace function link_landing_submission(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.landing_flow_submissions
  set converted_user_id = auth.uid(),
      converted_at = now()
  where anonymous_token = p_token
    and converted_user_id is null;
end;
$$;

revoke all on function link_landing_submission(uuid) from public;
grant execute on function link_landing_submission(uuid) to authenticated;

comment on table landing_flow_submissions is 'Anonyme svar fra "Find ud af det selv"-flow på landing. Bruges til conversion-tracking. Ingen email/PII gemmes - kun sha256-hash af IP. Læsning kun via service-role.';
comment on column landing_flow_submissions.anonymous_token is 'Browser-genereret uuid bæres i localStorage. Kobles til auth.users via link_landing_submission().';
comment on column landing_flow_submissions.flow_state is 'Hele flow-state som jsonb - brikker, tre tal, unsureFields, householdAtZero, upcomingEvents.';
comment on column landing_flow_submissions.ip_hash is 'sha256(ip + secret) - til misbrugs-detektion, ikke marketing. Ikke reversibelt.';
comment on function link_landing_submission(uuid) is 'Linker en anonym submission til den authenticated bruger. Idempotent. Bruges af signup-action efter succesfuld konto-oprettelse.';

-- ----------------------------------------------------------------------------
-- Registrér rate-limit route i rate_limit_routes (migration 0048).
-- 30/time per IP er rigeligt til en seriøs besøgende, og blokerer
-- scripts der prøver at bloate tabellen.
-- ----------------------------------------------------------------------------
insert into public.rate_limit_routes (route, max_hits, window_seconds) values
  ('landing_flow_submission', 30, 3600)
on conflict (route) do nothing;

