-- ============================================================================
-- 0024 — Manuelt månedligt rådighedsbeløb pr. konto
-- ----------------------------------------------------------------------------
-- /husholdning skal vise "X brugt af Y i denne måned" hvor Y er det beløb
-- brugeren mentalt har afsat til dagligvarer. Det er IKKE det samme som de
-- recurring transfers ind på kontoen — brugeren kan have overført 8.000 kr
-- via fast overførsel men have et mentalt loft på 9.000 kr (eller omvendt).
-- Budgettet er et INTENT, overførslen er en handling.
--
-- Vi gemmer det som en simpel kolonne på accounts. Nullable fordi det kun
-- er meningsfuldt for kind='household'-konti — andre konto-typer ignorerer
-- feltet (men ingen schema-level enforcement, samme pattern som
-- gross_amount/pension_*-felterne kun er meningsfulde for income).
-- ============================================================================

alter table accounts
  add column if not exists monthly_budget bigint
    check (monthly_budget is null or monthly_budget >= 0);

comment on column accounts.monthly_budget is
  'Manuelt fastsat månedligt rådighedsbeløb i øre. Bruges af /husholdning som intent-budget for daily-spend tracker — uafhængigt af de faktiske transfers ind på kontoen.';
