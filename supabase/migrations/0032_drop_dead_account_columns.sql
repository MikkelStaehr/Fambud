-- Migration 0032: drop døde kolonner på accounts.
--
-- Audit (1. maj 2026) viste at fire kolonner er ubrugte siden de blev
-- indført, og fortsætter med at bloate AccountForm med felter ingen
-- udfylder:
--   - currency (alle rækker er 'DKK', ingen multi-valuta-support i UI)
--   - goal_amount, goal_date, goal_label (0 ud af 10 konti har sat
--     målfelterne - feature blev aldrig faktisk brugt)
--
-- Drop er sikker fordi DAL'en og UI'en altid har behandlet dem som
-- valgfri/ignoreret. Hvis vi senere genintroducerer mål eller multi-
-- valuta gør vi det med en frisk migration der modellerer behovet
-- ordentligt (fx en separat goals-tabel pr. konto).

alter table public.accounts
  drop column if exists currency,
  drop column if exists goal_amount,
  drop column if exists goal_date,
  drop column if exists goal_label;
