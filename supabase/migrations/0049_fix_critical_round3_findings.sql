-- Sikkerheds-hotfix runde 3 - 3 nye Critical fra re-audit:
--
-- 1. **P0 BUG**: guard_family_members_critical_columns blokerede
--    handle_new_user Path 1 (invite-adoption). Partner der forsøgte
--    at signe op via invite-kode fejlede med:
--      "Only the household owner can change role, user_id, ..."
--    fordi triggeren tjekker auth.uid() = owner, men ved signup er
--    den nye bruger jo ikke owner endnu (eller auth.uid() er NULL).
--    Alle invite-flows har været brudt siden migration 0046.
--
-- 2. **C1**: rate_limit_routes manglede RLS. Authenticated brugere
--    kunne via Supabase REST API hæve max_hits til 999999 og
--    deaktivere rate-limiting globalt, eller slette rækker for at
--    fail-close ALLE auth-flows for alle brugere (DoS).
--
-- 3. **rate_limit_cleanup function**: blev allerede revoke'd, men
--    ekstra revoke fra public for konsistens.

-- ============================================================================
-- 1. P0 FIX: guard-trigger skal undtage SECURITY DEFINER trigger-callers
-- ============================================================================
-- pg_trigger_depth() > 1 betyder vi er inde i en nested trigger - dvs.
-- handle_new_user fyrede en UPDATE på family_members, der fyrede vores
-- guard. Vi stoler på handle_new_user (den er SECURITY DEFINER og
-- kontrolleret af os). Direct UPDATE fra app-kode har depth = 1.
create or replace function public.guard_family_members_critical_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
begin
  -- Hvis vi kaldes fra en anden trigger (fx handle_new_user der
  -- adopterer en pre-godkendelse-række), spring tjekket over.
  -- handle_new_user er selv kontrolleret kode der ikke kan misbruges
  -- til privilege escalation.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- No-op hvis ingen kritiske felter ændres
  if  new.role is not distinct from old.role
  and new.user_id is not distinct from old.user_id
  and new.household_id is not distinct from old.household_id
  and new.email is not distinct from old.email
  and new.setup_completed_at is not distinct from old.setup_completed_at
  and new.position is not distinct from old.position
  and new.joined_at is not distinct from old.joined_at then
    return new;
  end if;

  -- Kritisk felt ændres direkte fra app - kræv owner.
  -- (joined_at tilføjet til fail-closed-listen - audit fandt at
  -- bruger kunne tilbageføre joined_at via self-update.)
  select exists (
    select 1 from public.family_members
    where household_id = old.household_id
      and user_id = auth.uid()
      and role = 'owner'
  ) into is_owner;

  if not is_owner then
    raise exception 'Only the household owner can change role, user_id, household_id, email, setup_completed_at, position or joined_at'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 2. C1 FIX: enable RLS på rate_limit_routes + revoke writes
-- ============================================================================
alter table public.rate_limit_routes enable row level security;

-- Ingen policies → default deny for anon/authenticated. Tabellen kan
-- kun læses/skrives via service_role (som bypasser RLS) eller via
-- vores SECURITY DEFINER funktion rate_limit_check der tager
-- hardcoded values. Hvis nogen behov i fremtiden om at justere
-- rate-limits, gøres det via Supabase Dashboard (service_role).

-- Defense-in-depth: revoke explicit
revoke all on public.rate_limit_routes from anon, authenticated;

-- ============================================================================
-- 3. rate_limit_cleanup ekstra revoke (var allerede revoke'd, men
--    bekræfter)
-- ============================================================================
revoke all on function public.rate_limit_cleanup() from public;
