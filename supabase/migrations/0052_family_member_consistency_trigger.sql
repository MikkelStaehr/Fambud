-- M1 fra runde 4 audit: transactions.family_member_id og
-- transaction_components.family_member_id refererer til family_members
-- via FK, men der er ingen consistency-trigger der enforce'r at de
-- peger på et family_member i SAMME husstand som parent-rækken.
--
-- En angriber der lærer en family_member_id fra en fremmed husstand
-- kunne tagge sin egen transaction med den fremmede id. Display er
-- beskyttet (RLS-join til family_members blokerer fremmed display),
-- men det er en data-integritets-skævhed der bør lukkes - i tråd med
-- de andre cross-household-triggers fra migrations 0045/0047.

create or replace function public.check_transaction_family_member_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fm_household_id uuid;
begin
  if new.family_member_id is null then
    return new;
  end if;
  select household_id into fm_household_id
  from public.family_members
  where id = new.family_member_id;
  if fm_household_id is null or fm_household_id <> new.household_id then
    raise exception 'family_member does not belong to this household'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists check_transaction_family_member_household on public.transactions;
create trigger check_transaction_family_member_household
  before insert or update of family_member_id, household_id on public.transactions
  for each row execute function public.check_transaction_family_member_household();

-- Samme tjek på transaction_components.family_member_id
create or replace function public.check_component_family_member_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fm_household_id uuid;
begin
  if new.family_member_id is null then
    return new;
  end if;
  select household_id into fm_household_id
  from public.family_members
  where id = new.family_member_id;
  if fm_household_id is null or fm_household_id <> new.household_id then
    raise exception 'component family_member does not belong to this household'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists check_component_family_member_household on public.transaction_components;
create trigger check_component_family_member_household
  before insert or update of family_member_id, household_id on public.transaction_components
  for each row execute function public.check_component_family_member_household();

-- Revoke EXECUTE fra anon/authenticated på de nye trigger-funktioner
revoke execute on function public.check_transaction_family_member_household() from public, anon, authenticated;
revoke execute on function public.check_component_family_member_household() from public, anon, authenticated;
