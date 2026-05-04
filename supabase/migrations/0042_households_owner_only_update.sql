-- SECURITY: Indtil nu kunne ALLE household-medlemmer kalde
-- supabase.from('households').update(...) direkte (fra browser-devtools
-- via den public anon-key). App-niveau-tjek i wizard/familie/actions.ts
-- enforced kun owner-rollen for setEconomyType - men en motiveret
-- angriber kunne springe action'en over og opdatere households-rækken
-- direkte. RLS skal være den autoritative grænse, ikke app-koden.
--
-- Vi udskifter den gamle "members update household"-policy med en der
-- kræver role = 'owner'. Almindelige medlemmer kan stadig SELECT (læse)
-- husstanden - de kan bare ikke ændre den.

drop policy if exists "members update household" on public.households;

create policy "owners update household"
  on public.households
  for update
  using (
    exists (
      select 1 from public.family_members
      where household_id = households.id
        and user_id = auth.uid()
        and role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.family_members
      where household_id = households.id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );
