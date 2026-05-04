-- ============================================================================
-- 0017 - Loan-specific metadata on credit accounts
-- ----------------------------------------------------------------------------
-- /wizard/kredit-laan already creates accounts with kind='credit', and 0005
-- gave them interest_rate + apr. This migration adds the rest of what a
-- loan-tracking page needs:
--
--   loan_type           Visual flavour ('kreditkort' | 'realkredit' | 'banklan'
--                       | 'kassekredit' | 'andet'). The wizard had this as a
--                       form field but never persisted it - now it does.
--   original_principal  Hovedstol - the loan amount when first taken. Stays
--                       fixed; opening_balance / current rest tracks paydown.
--   term_months         Løbetid in months (e.g. 360 for a 30-year realkredit).
--   lender              Långiver - free text (Realkredit Danmark, Nordea,…).
--   monthly_payment     Månedlig ydelse i øre. Used as the default amount when
--                       linking the loan to a budget account as a recurring
--                       expense ("Tilføj som månedlig udgift" on /laan).
--
-- All nullable - credit cards don't need term_months or original_principal,
-- realkredit doesn't really have a single monthly_payment if you mix afdrag
-- + bidrag + rente in components, etc.
-- ============================================================================

alter table accounts
  add column if not exists loan_type text
    check (loan_type is null or loan_type in
      ('kreditkort', 'realkredit', 'banklan', 'kassekredit', 'andet')),
  add column if not exists original_principal bigint
    check (original_principal is null or original_principal >= 0),
  add column if not exists term_months int
    check (term_months is null or term_months > 0),
  add column if not exists lender text,
  add column if not exists monthly_payment bigint
    check (monthly_payment is null or monthly_payment >= 0);
