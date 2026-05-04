-- ============================================================================
-- 0022 - Lønseddel-deductions på income transactions
-- ----------------------------------------------------------------------------
-- 0016 gav os bruttoløn + pension-procenter. Det dækker det grundlæggende
-- pensionsbillede, men en typisk dansk lønseddel har også fradrag som
-- A-kasse, fagforening, gruppeliv-forsikring, frokostordning osv. - og det
-- er præcis dem brugeren oftest gerne vil holde styr på når de prøver at
-- forklare hvor pengene mellem brutto og netto blev af.
--
-- Vi tilføjer tre nullable kolonner pr. lønindeholdt fradrag:
--   akasse_amount             A-kasse pr. periode (i øre)
--   fagforening_amount        Fagforening pr. periode (i øre)
--   other_deduction_amount    Andet - f.eks. gruppeliv, sundhedsforsikring,
--                             frokost, leasing-frikøb (i øre)
--   other_deduction_label     Tekst-label til "andet" så brugeren selv kan
--                             beskrive hvad det er (vises i UI'et)
--
-- Alle nullable. Kun meningsfulde for indkomst-transaktioner, men vi enforcer
-- det ikke på skema-niveau - samme pattern som gross_amount/pension_*.
--
-- Disse felter sammen med gross_amount + pension_own_pct giver os nok til
-- at vise en lille lønseddel-summary ("brutto → fradrag → pension → netto")
-- på /indkomst-formen.
-- ============================================================================

alter table transactions
  add column if not exists akasse_amount bigint
    check (akasse_amount is null or akasse_amount >= 0),
  add column if not exists fagforening_amount bigint
    check (fagforening_amount is null or fagforening_amount >= 0),
  add column if not exists other_deduction_amount bigint
    check (other_deduction_amount is null or other_deduction_amount >= 0),
  add column if not exists other_deduction_label text;
