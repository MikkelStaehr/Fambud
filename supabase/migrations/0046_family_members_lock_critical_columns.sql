-- SECURITY (Critical): Den eksisterende "members manage family"-policy
-- gav alle husstandsmedlemmer FULD UPDATE-adgang til family_members
-- inden for husstanden. Et medlem kunne selv-promovere via direkte
-- Supabase-kald:
--   await supabase.from('family_members')
--     .update({ role: 'owner' }).eq('user_id', myUserId)
-- RLS tillod det. Det undergraver alle de owner-only app-niveau-checks
-- vi tilføjede (createFamilyMember, deleteFamilyMember, setEconomyType,
-- setNewPassword osv.) - en angriber kunne bare self-promovere først.
--
-- Vi splitter policy'en i:
--   - SELECT/INSERT/DELETE: stadig for medlemmer (managed via app-tjek)
--   - UPDATE: medlemmer må kun ændre "ufarlige" felter på SIG SELV
--     (navn, profilfelter); kritiske felter (role, user_id, household_id,
--     email, setup_completed_at) må kun ændres af owner

-- Drop den brede policy
drop policy if exists "members manage family" on public.family_members;

-- SELECT: alle medlemmer kan se hinanden
create policy "members select family"
  on public.family_members for select
  using (public.is_household_member(household_id));

-- INSERT: alle medlemmer (vi har app-niveau owner-tjek for createFamilyMember)
-- - vi kan IKKE gøre RLS owner-only her, fordi handle_new_user trigger
--   selv inserter ved signup og kører som SECURITY DEFINER (bypasser RLS),
--   og fordi wizard-flows måske skal tillade ikke-owner inserts. App-tjek
--   blokerer den primære vej.
create policy "members insert family"
  on public.family_members for insert
  with check (public.is_household_member(household_id));

-- DELETE: alle medlemmer (app-niveau tjek i deleteFamilyMember /
-- removeFamilyMember begrænser til owner + non-active rows)
create policy "members delete family"
  on public.family_members for delete
  using (public.is_household_member(household_id));

-- UPDATE: SELF kan opdatere ufarlige felter (navn, adresser, indkomst-
-- kilde, fødselsdag, tour-state). OWNER kan opdatere alt for medlemmer
-- i sin husstand.
--
-- Vi splitter i to policies; PostgreSQL OR'er dem sammen, så hvis
-- nogen af dem matcher, er UPDATE tilladt.

-- Policy A: bruger må opdatere sin egen række
-- Vigtigt: der er INGEN måde at sige "kun visse kolonner" i RLS UPDATE -
-- USING/CHECK gælder for hele rækken. Vi løser det med en BEFORE UPDATE
-- trigger nedenfor der raise'r hvis kritiske kolonner ændres af ikke-owner.
create policy "self update own family row"
  on public.family_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Policy B: owner i husstanden må opdatere alle rækker
create policy "owner updates family in household"
  on public.family_members for update
  using (
    exists (
      select 1 from public.family_members fm_owner
      where fm_owner.household_id = family_members.household_id
        and fm_owner.user_id = auth.uid()
        and fm_owner.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.family_members fm_owner
      where fm_owner.household_id = family_members.household_id
        and fm_owner.user_id = auth.uid()
        and fm_owner.role = 'owner'
    )
  );

-- BEFORE UPDATE trigger: blokér ændringer af kritiske felter når
-- caller ikke er owner. Det her er nødvendigt fordi RLS ikke kan
-- begrænse på kolonne-niveau - den "self update"-policy ovenfor ville
-- ellers tillade self.role = 'owner'.
create or replace function public.guard_family_members_critical_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
begin
  -- Hvis disse felter ikke ændres, behøver vi ikke tjekke noget.
  if  new.role is not distinct from old.role
  and new.user_id is not distinct from old.user_id
  and new.household_id is not distinct from old.household_id
  and new.email is not distinct from old.email
  and new.setup_completed_at is not distinct from old.setup_completed_at
  and new.position is not distinct from old.position then
    return new;
  end if;

  -- Kritisk felt ændres - kræv owner. SECURITY DEFINER så vi kan læse
  -- family_members-tabellen uden RLS-recursion.
  select exists (
    select 1 from public.family_members
    where household_id = old.household_id
      and user_id = auth.uid()
      and role = 'owner'
  ) into is_owner;

  if not is_owner then
    raise exception 'Only the household owner can change role, user_id, household_id, email, setup_completed_at or position'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_family_members_critical_columns on public.family_members;
create trigger guard_family_members_critical_columns
  before update on public.family_members
  for each row execute function public.guard_family_members_critical_columns();
