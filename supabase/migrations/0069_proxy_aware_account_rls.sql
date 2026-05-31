-- ============================================================================
-- 0069 - Proxy-aware RLS på accounts + can_write_account
-- ----------------------------------------------------------------------------
-- Udvider RLS-policies så user-client virker for proxy-grantee i stedet for
-- at kræve admin-client + manuel filter (v1.5-v2.1's mønster). Defense-in-
-- depth: hvis app-layer filter glemmes, RLS afviser stadig cross-household-
-- leak; per-perspective-isolation kan dog brydes (UX-bug ikke security-leak).
--
-- Effekt på app-laget:
--   - DAL der bruger user-client + RLS får nu "union view" (egne + proxy-
--     grantor's data) sålænge grant er aktiv. Det kræver at DAL-funktioner
--     filtrerer eksplicit for cookie-OFF "min view"-mode - se DAL-refactor
--     i samme commit.
--   - admin-client bypass er ikke længere nødvendig for de fleste flows.
--     getPerspective() kan returnere user-client i stedet for admin-client.
--
-- Reference: docs/proxy-rls-design.md (design-doc fra v2.2). Migration
-- udfører "Step 1" af 3-trins-cutover. Step 2 (DAL-filter) og Step 3
-- (fjern admin-client) er separate commits.
-- ============================================================================

-- 1. can_write_account() honorerer active proxy
-- ------------------------------------------------
-- Denne funktion bruges af transactions, transfers og transaction_components'
-- write-policies. Ved at udvide den her, kaskader proxy-permission til alle
-- afledte ressourcer uden at vi skal opdatere hver enkelt policy.
create or replace function public.can_write_account(account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.accounts a
    where a.id = account_id
      and public.is_household_member(a.household_id)
      and (
        a.editable_by_all
        or a.created_by = auth.uid()
        or public.has_active_proxy(a.created_by, auth.uid(), 'setup')
      )
  );
$$;

-- 2. accounts SELECT honorerer active proxy
-- ------------------------------------------------
-- Drop den private-aware policy fra 0030 og genopret med proxy-clausen.
drop policy if exists "private-aware read accounts" on accounts;
create policy "private-aware read accounts"
  on accounts for select
  using (
    public.is_household_member(household_id)
    and (
      editable_by_all
      or created_by = auth.uid()
      or public.has_active_proxy(created_by, auth.uid(), 'setup')
    )
  );

-- 3. accounts UPDATE honorerer active proxy
-- ------------------------------------------------
-- Skift fra 0003's "writable update accounts" til proxy-aware version.
drop policy if exists "writable update accounts" on accounts;
create policy "writable update accounts"
  on accounts for update
  using (
    public.is_household_member(household_id)
    and (
      editable_by_all
      or created_by = auth.uid()
      or public.has_active_proxy(created_by, auth.uid(), 'setup')
    )
  )
  with check (
    public.is_household_member(household_id)
    and (
      editable_by_all
      or created_by = auth.uid()
      or public.has_active_proxy(created_by, auth.uid(), 'setup')
    )
  );

-- 4. accounts DELETE honorerer active proxy
-- ------------------------------------------------
-- Sjælden operation (vi bruger archive i UI'en) men policy skal være konsistent.
drop policy if exists "writable delete accounts" on accounts;
create policy "writable delete accounts"
  on accounts for delete
  using (
    public.is_household_member(household_id)
    and (
      editable_by_all
      or created_by = auth.uid()
      or public.has_active_proxy(created_by, auth.uid(), 'setup')
    )
  );

-- 5. accounts INSERT: ingen ændring nødvendig
-- ------------------------------------------------
-- "members insert accounts" policy fra 0003 tjekker kun is_household_member.
-- Det er allerede tilstrækkeligt - Mikkel kan altid INSERT accounts i sin
-- husstand. Han sætter created_by = perspectiveUserId (Louise) via app-laget
-- når proxy er aktiv (se app/(app)/konti/actions.ts createAccount).

-- ============================================================================
-- Verifikation efter migration:
-- ----------------------------------------------------------------------------
-- Som Mikkel (caller) med aktiv grant fra Louise, kør:
--   select id, name, created_by from accounts;
-- Skal returnere: shared + Mikkels private + Louises private (union).
-- Uden grant returnerer den: shared + Mikkels private (current behavior).
-- ============================================================================
