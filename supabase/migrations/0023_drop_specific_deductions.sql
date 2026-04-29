-- ============================================================================
-- 0023 — Forenkl lønseddel: ét generisk Fradrag-felt i stedet for tre
-- ----------------------------------------------------------------------------
-- 0022 tilføjede tre dedikerede fradrag (akasse_amount, fagforening_amount,
-- other_deduction_amount). I praksis var det for granuleret — brugeren vil
-- bare have ÉT "Fradrag"-felt ved siden af bruttoløn og pension.
--
-- Vi beholder other_deduction_amount + other_deduction_label fra 0022 (de
-- fungerer fint som det generiske felt + valgfri label). Vi dropper de to
-- specifikke kolonner. IF EXISTS gør droppet idempotent — virker uanset om
-- 0022 blev kørt eller ej.
-- ============================================================================

alter table transactions
  drop column if exists akasse_amount,
  drop column if exists fagforening_amount;
