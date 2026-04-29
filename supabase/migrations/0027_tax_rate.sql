-- ============================================================================
-- 0027 — tax_rate_pct (trækprocent) på transactions
-- ----------------------------------------------------------------------------
-- Med skattefradrag (other_deduction_amount) + trækprocent kan vi udregne
-- den FORUDSAGTE skat og dermed netto. Det betyder at lønseddel-builderen
-- går fra at regne skat baglæns (brutto − pension − netto) til at regne
-- den forlæns:
--
--   AM-grundlag           = brutto − pension egen
--   AM-bidrag (8%)        = 8 % af AM-grundlag        (fast i DK, ikke input)
--   Skattegrundlag        = AM-grundlag − AM-bidrag
--   Beskatningsgrundlag   = Skattegrundlag − skattefradrag
--   A-skat                = Beskatningsgrundlag × trækprocent
--   Forudsagt netto       = brutto − pension − AM-bidrag − A-skat
--
-- Konsekvensen er at brugeren kan opdage hvis deres input afviger fra
-- lønsedlen — og så får et reality-check på om dit lønsystem trækker
-- noget vi har misset (ATP, kantinekøb, etc.).
--
-- Idempotent: add column if not exists, plus check-constraint på range
-- 0-100 for at fange typo-fejl ("39" vs "0,39").
-- ============================================================================

alter table transactions
  add column if not exists tax_rate_pct real
    check (tax_rate_pct is null or (tax_rate_pct >= 0 and tax_rate_pct <= 100));
