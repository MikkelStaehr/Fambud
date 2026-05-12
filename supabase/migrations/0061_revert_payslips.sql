-- ============================================================================
-- 0061 - Revert af 0060: drop lønseddel-feature
-- ----------------------------------------------------------------------------
-- Vi byggede manuel lønseddel-registrering (migration 0060, PR 6) men
-- konkluderede at value/friction-balancen ikke holdt: brugeren skulle
-- registrere 8-10 linjer hver måned med ringe variance, og hovedværdien
-- (feriesaldo, lønfejl-detection) kan løses smartere via enkelt-felt
-- input + eksisterende indkomstdata fra wizarden.
--
-- I stedet planlægger vi en "månedlig audit"-agent der bygger på data
-- vi allerede har frem for at kræve nyt manuelt input. Lønseddel-tabellerne
-- droppes så vi ikke efterlader ubrugt schema.
--
-- Sikkerhed: brugeren har bekræftet at der ikke er reel data i tabellerne
-- (kun lokal test-data), så ingen backfill nødvendig. Hvis nogen mod
-- forventning har data, taber de det her - acceptabelt fordi feature'en
-- aldrig ramte produktion.
-- ============================================================================

-- Drop tabellerne i FK-rækkefølge: payslip_lines refererer payslips,
-- så payslip_lines først.
drop table if exists payslip_lines;
drop table if exists payslips;

-- Drop enum'en. Den bruges kun af payslip_lines.category, så efter
-- tabel-drop er den orphan.
drop type if exists payslip_line_category;
