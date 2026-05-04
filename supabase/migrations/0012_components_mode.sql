-- ============================================================================
-- 0012 - components_mode: additive vs breakdown
-- ----------------------------------------------------------------------------
-- Components fit two distinct real-world patterns:
--
--   1. ADDITIVE (default) - parent is a base price, components stack on top.
--      "Mobilabonnement 170 kr + Spotify 200 + Premium 99 = 469 kr/md"
--      effective = parent + sum(components)
--
--   2. BREAKDOWN - parent IS the total bill, components describe the parts.
--      "Bilforsikring 806.09 kr/md, broken down as: Ansvar 164 + Kasko 438
--       + Friskade 36 + Statsafgift 70 + …"
--      effective = parent  (components are informational only)
--
-- Sticking with text + check constraint over a boolean so the column
-- self-documents in queries: ' = additive' is clearer than ' = false'.
-- ============================================================================

alter table transactions
  add column if not exists components_mode text not null default 'additive'
  check (components_mode in ('additive', 'breakdown'));

comment on column transactions.components_mode is
  'How transaction_components relate to the parent amount. ''additive'' (default): effective amount = parent + sum(components). ''breakdown'': effective amount = parent (components are informational decomposition).';
