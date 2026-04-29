-- ============================================================================
-- 0026 — hovedindkomst vs biindkomst + indkomst-kilde pr. familiemedlem
-- ----------------------------------------------------------------------------
-- Indkomst-motoren har hidtil behandlet alle income-kategoriserede
-- transaktioner ens. Det giver to problemer:
--
--   1. Vi kan ikke skelne en hovedindkomst (løn / understøttelse) fra en
--      biindkomst (freelance, B-skat, udbytte) når vi vil lave forecast.
--   2. Brugeren kan kun skrive "ca. så meget tjener jeg pr. md" som et
--      brugerskøn — vi har intet ankerpunkt i faktiske udbetalinger og
--      kan derfor ikke fange variansen i overtid, bonus, mv.
--
-- Vi tilføjer to felter:
--
--   transactions.income_role
--     'primary' = hovedindkomst (én pr. person — løn eller understøttelse)
--     'secondary' = biindkomst (alt andet income-kategoriseret)
--     null = ikke kategoriseret endnu (bagudkompatibel med eksisterende rows)
--
--   family_members.primary_income_source
--     'salary' = personen er på løn
--     'benefits' = personen er på understøttelse / dagpenge
--     null = ikke valgt endnu
--
-- Forecast-motoren bruger kombinationen: den finder personens primær-
-- transaktioner (income_role='primary'), kigger på de seneste N
-- 'once'-udbetalinger, og beregner et glidende gennemsnit. Vi håndhæver
-- IKKE i DB at en person kun har én 'primary' — UI'et håndterer det.
--
-- Idempotent: enum-types kun hvis ikke eksisterer, kolonner med if not exists.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'income_role') then
    create type income_role as enum ('primary', 'secondary');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'primary_income_source') then
    create type primary_income_source as enum ('salary', 'benefits');
  end if;
end $$;

alter table transactions
  add column if not exists income_role income_role;

alter table family_members
  add column if not exists primary_income_source primary_income_source;

-- Hjælper-index: forecast-motoren slår 'once'-udbetalinger op pr. familie-
-- medlem sorteret efter dato. Med income_role i WHERE'en og family_member_id +
-- occurs_on i index'et undgår vi sequential scan når listen vokser.
create index if not exists transactions_primary_paychecks_idx
  on transactions (family_member_id, occurs_on desc)
  where income_role = 'primary' and recurrence = 'once';
