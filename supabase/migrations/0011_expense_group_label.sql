-- ============================================================================
-- 0011 — Optional group_label on transactions
-- ----------------------------------------------------------------------------
-- A free-form tag that lets the user cluster expenses under a common name
-- WITHIN a category. Typical use: "Popermo" groups all the household's
-- Popermo-issued insurances under one foldable section in /budget. The
-- forsikring-category total stays correct; we just gain a sub-grouping level
-- for clarity.
--
-- Free-form text rather than a separate `groups` table because:
--   - Users will type provider names (Popermo, TopDanmark, Lærerstandens
--     Brandforsikring) — there's no canonical list to select from.
--   - Same string = same group (HTML datalist suggests existing values to
--     reduce typos).
--   - One column, no joins, easy to query "show me all expenses tagged
--     Popermo across the household".
--
-- The partial index supports the autocomplete query (distinct labels per
-- household) without indexing the bulk of NULL rows.
-- ============================================================================

alter table transactions
  add column if not exists group_label text;

create index if not exists transactions_household_group_idx
  on transactions(household_id, group_label)
  where group_label is not null;
