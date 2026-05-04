-- Strammer SELECT-policies så private konti (editable_by_all=false) kun er
-- synlige for deres creator. Tidligere kunne alle husstandsmedlemmer
-- læse ALT - så Louise så Mikkel's private udgifter fra hans lønkonto.
-- Read-permissions matcher nu write-permissions: editable_by_all=true er
-- "fælles" (alle ser + skriver), mens editable_by_all=false er "privat"
-- (kun creator ser + skriver).
--
-- Effekt på almindelige flows:
--   • Mikkel's lønkonto (private)         → kun Mikkel ser den + dens transaktioner
--   • Louise's lønkonto (private)         → kun Louise ser den + dens transaktioner
--   • Fælles budgetkonto (editable_by_all)→ begge ser + skriver
--   • Buffer (Fælles)                      → begge ser + skriver
--   • Børneforbrugskonto (editable_by_all)→ begge forældre ser + skriver
--
-- Transfers: synlige hvis MINDST én af from/to er læsbar. Det betyder
-- Louise stadig kan se "Fælles modtog 5.000 kr" selvom kilden er Mikkel's
-- private lønkonto - UI må håndtere at from_account-joinet returnerer
-- null (RLS strips når kontoen ikke er læsbar).

-- ----------------------------------------------------------------------------
-- accounts.SELECT
-- ----------------------------------------------------------------------------
drop policy if exists "members read accounts" on accounts;

create policy "private-aware read accounts"
  on accounts for select
  using (
    public.is_household_member(household_id)
    and (editable_by_all or created_by = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- transactions.SELECT - gates på den underliggende kontos læs-permission
-- ----------------------------------------------------------------------------
drop policy if exists "members read transactions" on transactions;

create policy "private-aware read transactions"
  on transactions for select
  using (
    public.is_household_member(household_id)
    and public.can_write_account(account_id)
  );

-- ----------------------------------------------------------------------------
-- transfers.SELECT - synlig hvis enten from eller to er læsbar
-- ----------------------------------------------------------------------------
drop policy if exists "members read transfers" on transfers;

create policy "private-aware read transfers"
  on transfers for select
  using (
    public.is_household_member(household_id)
    and (
      public.can_write_account(from_account_id)
      or public.can_write_account(to_account_id)
    )
  );
