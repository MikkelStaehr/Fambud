-- Migration 0063: indkomst synlig på tværs af husstanden
--
-- Migration 0030/0031 gjorde lønkonti (kind='checking') private mellem
-- partnere, så man ikke kan se hinandens personlige FORBRUG. Men det skjulte
-- som bivirkning OGSÅ partnerens INDKOMST - og for et par der budgetterer
-- sammen er fælles indkomst-overblik nødvendigt:
--   • /indkomst viser en sektion pr. husstandsmedlem (forecast pr. person)
--   • dashboardets "manglende bidragyder"-tjek skal kunne se begges lønsedler
--     for ikke at fejl-alarmere når partneren reelt har registreret sin løn
--
-- Tidligere "virkede" det kun fordi partnerens lønsedler ved en fejl lå på
-- den indloggede brugers (synlige) konto. Da data blev ryddet op (hver løn
-- på sin egen private lønkonto), forsvandt partnerens indkomst fra overblik.
--
-- Løsning: en ekstra permissive SELECT-policy der lader husstandsmedlemmer
-- læse INDKOMST-transaktioner uanset kontoens privatlivs-flag. RLS-policies
-- OR'es, så den private-aware policy fra 0030 stadig gælder for alt andet:
-- udgifter (income_role null + ikke-income-kategori) forbliver private.
-- Resultat: indkomst delt i husstanden, forbrug privat.
--
-- "Indkomst" defineres som transaktioner med income_role sat (primær/
-- sekundær løn = paychecks) ELLER en kategori af kind='income' (fx
-- tilbagevendende indtægter). Begge er ufarlige at dele inden for husstanden;
-- det er det private forbrug 0030 beskytter, ikke indkomsten.

create policy "household read income transactions"
  on transactions for select
  using (
    public.is_household_member(household_id)
    and (
      income_role is not null
      or exists (
        select 1 from public.categories c
        where c.id = transactions.category_id
          and c.kind = 'income'
      )
    )
  );
