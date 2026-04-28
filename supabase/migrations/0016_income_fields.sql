-- ============================================================================
-- 0016 — Optional gross-salary + pension percentages on income transactions
-- ----------------------------------------------------------------------------
-- transactions.amount stays the cashflow amount — what actually lands on the
-- account (typically nettoløn for income transactions). We add three optional
-- companion fields that turn an income row into a full salary picture:
--
--   gross_amount         bigint øre. Bruttoløn before tax / pension deduction.
--                        Nullable: most users only enter net.
--   pension_own_pct      Employee contribution as % of gross. e.g. 5.5 = 5,5%.
--                        Stored as real for the same reason interest_rate
--                        and apr are real (0005): supabase-js returns numeric
--                        as string, but real comes back as number, and 2-dp
--                        precision on a percentage doesn't need numeric.
--   pension_employer_pct Employer contribution as % of gross. e.g. 10 = 10%.
--
-- Only meaningful for income transactions (category.kind = 'income'), but we
-- don't enforce that at the schema level — same pattern as group_label, which
-- could theoretically apply to anything but in practice doesn't.
--
-- A later milestone (forsikrings-/pensionstjek) will read these fields to
-- compute total annual pension contribution and project a balance.
-- ============================================================================

alter table transactions
  add column if not exists gross_amount bigint
    check (gross_amount is null or gross_amount >= 0),
  add column if not exists pension_own_pct real
    check (pension_own_pct is null or
           (pension_own_pct >= 0 and pension_own_pct <= 100)),
  add column if not exists pension_employer_pct real
    check (pension_employer_pct is null or
           (pension_employer_pct >= 0 and pension_employer_pct <= 100));
