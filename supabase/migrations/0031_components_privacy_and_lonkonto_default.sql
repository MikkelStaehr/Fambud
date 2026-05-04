-- Migration 0031:
--   1. private-aware policies på transaction_components - så components på
--      private transaktioner ikke leakes til andre husstandsmedlemmer.
--      Tidligere "members all components ALL" lod alle læse alt.
--   2. Datapatch: eksisterende lønkonti (kind='checking') med
--      editable_by_all=true ændres til false. Wizarden defaulter nu til
--      private for nye konti, men gamle konti har stadig den åbne flag -
--      så Migration 0030's privat-policy faktisk får effekt på dem.
--
-- Hvis et husstandsmedlem aktivt vil dele sin lønkonto kan de slå
-- editable_by_all til via /konti/[id] efter migrationen.

-- ----------------------------------------------------------------------------
-- 1. transaction_components: private-aware via parent transaction
-- ----------------------------------------------------------------------------
drop policy if exists "members all components" on transaction_components;

-- SELECT: synlig hvis underliggende transaktions konto er læsbar
create policy "private-aware read components"
  on transaction_components for select
  using (
    public.is_household_member(household_id)
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_components.transaction_id
        and public.can_write_account(t.account_id)
    )
  );

-- INSERT: skrivbar hvis underliggende transaktions konto er skrivbar
create policy "writable insert components"
  on transaction_components for insert
  with check (
    public.is_household_member(household_id)
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and public.can_write_account(t.account_id)
    )
  );

-- UPDATE: skrivbar hvis konto er skrivbar
create policy "writable update components"
  on transaction_components for update
  using (
    public.is_household_member(household_id)
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_components.transaction_id
        and public.can_write_account(t.account_id)
    )
  )
  with check (
    public.is_household_member(household_id)
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and public.can_write_account(t.account_id)
    )
  );

-- DELETE: skrivbar hvis konto er skrivbar
create policy "writable delete components"
  on transaction_components for delete
  using (
    public.is_household_member(household_id)
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_components.transaction_id
        and public.can_write_account(t.account_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Datapatch: eksisterende lønkonti markeres private
-- ----------------------------------------------------------------------------
-- Engangs-update der bringer eksisterende konti i overensstemmelse med den
-- nye default. Påvirker kun kind='checking' (lønkontoer) - fælleskonti,
-- børnekonti og opsparingskonti er bevidst delte og skal ikke ændres.
update public.accounts
set editable_by_all = false
where kind = 'checking'
  and editable_by_all = true;
