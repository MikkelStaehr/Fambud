-- P0 FIX: Hver eneste non-owner partner-signup har været brudt siden
-- runde 2 (migration 0046). Symptom: efter wizard er færdig kalder
-- /wizard/done completeSetup → mark_setup_complete RPC → UPDATE
-- family_members set setup_completed_at. Den UPDATE trigger'er
-- guard_family_members_critical_columns på depth=1 (mark_setup_complete
-- er en SECURITY DEFINER FUNCTION, ikke en nested trigger), så
-- pg_trigger_depth() > 1-bypass'en fra runde 4 hjælper ikke. Trigger
-- ser at setup_completed_at ændres → tjekker owner-rolle → non-owner
-- partner får 'insufficient_privilege' og bliver hængende i wizarden.
--
-- Fix: setup_completed_at og joined_at og position er IKKE
-- sikkerheds-kritiske felter. Brugeren skal kunne markere sin egen
-- wizard som færdig. RLS-policy'en "self update own family row"
-- (migration 0046) sikrer fortsat at en bruger kun kan opdatere SIN
-- EGEN række. Owner-tjekket bør kun gælde for felter der KAN bruges
-- til privilege escalation:
--   - role: kunne self-promote til owner
--   - user_id: kunne kapre andres ID
--   - household_id: kunne flytte sin række til en anden husstand
--   - email: kunne skifte email på en pre-godkendelse
--
-- Vi fjerner setup_completed_at, joined_at, position fra
-- critical-listen. Self-update via RLS + denne reduceret guard giver
-- den rigtige sikkerhed uden at blokere normale flows.

create or replace function public.guard_family_members_critical_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
begin
  -- Hvis kaldt fra en anden trigger (fx handle_new_user), spring guard'en
  -- over. Vi stoler på vores egne kontrollerede triggers.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- No-op hvis ingen ÆGTE kritiske felter ændres. Vi har bevidst
  -- droppet setup_completed_at, joined_at og position - de er ikke
  -- security-kritiske og blev tidligere blokeret pga design-fejl.
  if  new.role is not distinct from old.role
  and new.user_id is not distinct from old.user_id
  and new.household_id is not distinct from old.household_id
  and new.email is not distinct from old.email then
    return new;
  end if;

  -- Kritisk felt ændres direkte fra app - kræv owner.
  select exists (
    select 1 from public.family_members
    where household_id = old.household_id
      and user_id = auth.uid()
      and role = 'owner'
  ) into is_owner;

  if not is_owner then
    raise exception 'Only the household owner can change role, user_id, household_id or email'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;
