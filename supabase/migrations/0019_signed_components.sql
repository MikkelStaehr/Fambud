-- ============================================================================
-- 0019 - allow signed transaction_components.amount
-- ----------------------------------------------------------------------------
-- The original CHECK (amount >= 0, migration 0010) was modeled on "tilkøb"
-- semantics: components stack additively on top of the parent. But when we
-- decompose a loan ydelse into rente/afdrag/bidrag/rabat, the rabat
-- (KundeKroner) REDUCES the ydelse - and storing it as a positive number
-- makes "Rabat 1.502,46 kr." look like an addition, which is the opposite
-- of what's actually happening.
--
-- Drop the constraint so rabat can be stored as a negative number. With
-- signed components:
--   * breakdown-mode: components naturally sum to parent total
--   * additive-mode: a discount can subtract from the parent base price
--
-- Idempotent: drop if exists.
-- ============================================================================

alter table transaction_components
  drop constraint if exists transaction_components_amount_check;
