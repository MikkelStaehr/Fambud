-- ============================================================================
-- 0025 - savings_purpose: special-purpose opsparingskonti
-- ----------------------------------------------------------------------------
-- Vi har brug for at kunne identificere to specifikke konto-formål blandt
-- kind='savings'-konti, så vi kan beregne målbeløb og hjælpe brugeren med
-- at se om de er på sporet:
--
--   buffer:                 Nødfond. Tommelfinger: kunne dække 3 mdr af
--                           husstandens faste udgifter (minimum), 6 mdr
--                           ved godt niveau. Ved jobtab, sygdom, akut
--                           reparation.
--
--   predictable_unexpected: "Forudsigelige uforudsete" - pulje til ting
--                           du VED kommer (bilvedligehold, tandlæge,
--                           gaver, ferie). Foreslået: 15% af husstandens
--                           samlede nettoindkomst pr. år.
--
-- Begge er kind='savings'-konti, men deres specifikke formål gør at vi
-- kan beregne anbefalede målbeløb baseret på brugerens egne tal (faste
-- udgifter, indkomst). Vi modellerer det som en text-kolonne med check-
-- constraint i stedet for en enum så vi let kan tilføje flere formål
-- senere uden ALTER TYPE-cirkus.
--
-- Kolonnen er nullable - almindelige opsparingskonti uden specifikt
-- formål (fx "Sommerferie 2027") behøver ikke sætte den.
-- ============================================================================

alter table accounts
  add column if not exists savings_purpose text
    check (savings_purpose is null or
           savings_purpose in ('buffer', 'predictable_unexpected'));

comment on column accounts.savings_purpose is
  'Specialfunktion for kind=savings: buffer (nødfond, 3-6 mdr faste udgifter) eller predictable_unexpected (15% af nettoindkomst, til forudsigelige uforudsete udgifter).';
