-- ============================================================================
-- 0058 - Begivenheder: deadline obligatorisk + status auto-derive
-- ----------------------------------------------------------------------------
-- Brugerens beslutning: en begivenhed UDEN deadline giver ingen meningsfuld
-- planlægning - hverken cashflow-mæssigt eller for agentens forslag. Vi
-- tvinger derfor at præcis én af target_date / timeframe er sat.
--
-- Backfill: hvis der mod forventning skulle være eksisterende rækker uden
-- deadline (typisk fra første test-iteration), defaulter vi dem til
-- timeframe='within_10y'. Det er den løseste bucket og påvirker ikke
-- regnskabet væsentligt for nogen.
--
-- Kombineret med XOR-constraint'en fra 0056 betyder det:
--   target_date != null XOR timeframe != null  ⇒ præcis én er sat.
-- ============================================================================

-- Backfill: sæt en default på rækker der mod forventning mangler deadline.
update life_events
set timeframe = 'within_10y'
where target_date is null and timeframe is null;

-- Constraint: mindst én af de to skal være sat. Sammen med eksisterende
-- life_events_date_xor_timeframe (kun én må være sat samtidig) giver det
-- en ren XOR-semantik.
alter table life_events
  add constraint life_events_must_have_deadline
  check (target_date is not null or timeframe is not null);
