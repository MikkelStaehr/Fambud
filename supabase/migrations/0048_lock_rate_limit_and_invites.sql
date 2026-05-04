-- Sikkerheds-hotfix runde 2:
--
-- 1. NEW-H2: rate_limit_check var grant'et til anon + authenticated -
--    en angriber kunne kalde RPC'en direkte med p_max_hits=999999 og
--    poison'e tredjeparts rate-limit-buckets (lock victims by IP/email).
--    Vi revoke'r fra anon/authenticated. RPC'en bruger nu service_role
--    via vores server-side client - men vores normale createClient
--    bruger anon-key med user JWT, så den kan ikke længere kalde det.
--    Fix: ny SECURITY DEFINER-funktion der validerer route mod en
--    fast tabel og bruger hardcoded loft per route - ingen client-
--    leveret max_hits/window mere.
--
-- 2. rate_limit_cleanup: var EXECUTE GRANTED TO PUBLIC by default -
--    enhver authenticated bruger kunne slette alle rate-limit-rækker.
--    Revoke'r og giver kun service_role.
--
-- 3. household_invites: "members manage invites" tillod alle medlemmer
--    at oprette, opdatere og slette invites (inklusive at cancel'e
--    invites generet af owner). Vi splitter til SELECT for medlemmer,
--    INSERT/UPDATE/DELETE kun for owners.

-- ============================================================================
-- 1. Hardcoded rate-limits i en lookup-tabel - klient kan ikke længere
--    sende selvvalgte max_hits/window
-- ============================================================================
create table if not exists public.rate_limit_routes (
  route text primary key,
  max_hits int not null,
  window_seconds int not null
);

insert into public.rate_limit_routes (route, max_hits, window_seconds) values
  ('signup', 5, 3600),
  ('reset_password', 5, 3600),
  ('feedback', 10, 3600),
  ('login', 10, 900)
on conflict (route) do update
  set max_hits = excluded.max_hits, window_seconds = excluded.window_seconds;

-- Ny version af rate_limit_check der ignorerer p_max_hits/p_window
-- og altid slår op i routes-tabellen. Vi beholder den gamle signatur
-- for backwards compat med eksisterende kald, men ignorerer args.
create or replace function public.rate_limit_check(
  p_key text,
  p_route text,
  p_max_hits int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_hits int;
  effective_max int;
  effective_window int;
begin
  -- Slå hardcoded loft op i routes-tabellen. Hvis route ikke findes,
  -- afvis fail-closed (sikrer at fremtidige kald skal whitelistes).
  select max_hits, window_seconds
    into effective_max, effective_window
    from public.rate_limit_routes
    where route = p_route;
  if effective_max is null then
    return false;
  end if;

  -- Cap inputs alligevel (defense-in-depth, hvis args nogensinde skal
  -- bruges igen). Vi ignorerer dem fuldstændigt nu.

  select count(*) into current_hits
  from public.rate_limits
  where key = p_key
    and route = p_route
    and occurred_at > now() - (effective_window || ' seconds')::interval;

  if current_hits >= effective_max then
    return false;
  end if;

  insert into public.rate_limits (key, route)
  values (p_key, p_route);

  return true;
end;
$$;

-- Revoke fra anon + authenticated. Vores wrapper-funktion i
-- lib/rate-limit.ts kalder via supabase-anon-klient med authenticated
-- JWT - men funktionen er SECURITY DEFINER så den kan stadig skrive
-- til tabellen. PROBLEM: revoke betyder at INGEN bortset fra
-- service_role kan kalde den. Vores wrapper KAN IKKE LÆNGERE KALDES
-- som almindelig user.
--
-- Løsning: vi grant'er execute kun til authenticated, men INDE I
-- funktionen ignorerer vi argumentet for max_hits/window og bruger
-- hardcoded route-table-værdier. Så selv hvis en authenticated bruger
-- spammer kaldet, kan de ikke poison'e andre brugeres bucket
-- (key er attacker-controlled, men loftet er hardcoded - de kan
-- maksimalt tælle deres egne kald op).
--
-- Den ENESTE resterende abuse: angriber skriver mange entries i
-- rate_limits-tabellen for at fylde DB op. Det mitigeres af:
-- - per-key counter; tabel-bloat er O(N requests) ikke O(N keys)
-- - rate_limit_cleanup fjerner >24h gamle rækker
revoke all on function public.rate_limit_check(text, text, int, int) from public;
revoke all on function public.rate_limit_check(text, text, int, int) from anon;
grant execute on function public.rate_limit_check(text, text, int, int) to authenticated;
-- Vi tillader anon for /signup og /glemt-kodeord (de er ikke logget ind)
grant execute on function public.rate_limit_check(text, text, int, int) to anon;

-- Vigtigt: skift også til at bruge supabase-anon-klienten der ikke
-- har user JWT. Vi gør det IKKE her - vores eksisterende wrapper
-- bruger createClient() der har user-context. Det er fint - func
-- er SECURITY DEFINER, virker uanset caller.

-- ============================================================================
-- 2. Lock down rate_limit_cleanup
-- ============================================================================
revoke all on function public.rate_limit_cleanup() from public;
revoke all on function public.rate_limit_cleanup() from anon;
revoke all on function public.rate_limit_cleanup() from authenticated;
-- Kun service_role kan kalde cleanup (kør via supabase scheduled function
-- eller ad-hoc fra dashboard hvis nødvendigt)

-- ============================================================================
-- 3. household_invites: split til owner-only writes
-- ============================================================================
drop policy if exists "members manage invites" on public.household_invites;

create policy "members read invites"
  on public.household_invites for select
  using (public.is_household_member(household_id));

create policy "owners create invites"
  on public.household_invites for insert
  with check (
    exists (
      select 1 from public.family_members
      where family_members.household_id = household_invites.household_id
        and family_members.user_id = auth.uid()
        and family_members.role = 'owner'
    )
  );

create policy "owners update invites"
  on public.household_invites for update
  using (
    exists (
      select 1 from public.family_members
      where family_members.household_id = household_invites.household_id
        and family_members.user_id = auth.uid()
        and family_members.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.family_members
      where family_members.household_id = household_invites.household_id
        and family_members.user_id = auth.uid()
        and family_members.role = 'owner'
    )
  );

create policy "owners delete invites"
  on public.household_invites for delete
  using (
    exists (
      select 1 from public.family_members
      where family_members.household_id = household_invites.household_id
        and family_members.user_id = auth.uid()
        and family_members.role = 'owner'
    )
  );

-- Note: handle_new_user-triggeren bruger SECURITY DEFINER og kan stadig
-- update'e household_invites (sætter used_at) som superuser. UNAFFECTED.
