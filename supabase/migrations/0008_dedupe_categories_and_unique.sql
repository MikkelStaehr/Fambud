-- ============================================================================
-- 0008 — Deduplicate categories + add UNIQUE constraint
-- ----------------------------------------------------------------------------
-- ensureStandardExpenseCategories() in the app does SELECT-then-filter-then-
-- INSERT, which is not race-safe. With Next.js prefetching and multiple tabs,
-- two concurrent /budget loads could both observe "Frisør is missing" before
-- either has committed the INSERT — both insert, we end up with duplicates.
--
-- Fix in two steps:
--   1. Repoint any transactions referencing a non-canonical duplicate to the
--      canonical (oldest) row, then delete the duplicates.
--   2. Add a UNIQUE constraint on (household_id, name, kind) so future
--      inserts can't duplicate. The app then switches to upsert with
--      ignoreDuplicates for race-safe writes.
-- ============================================================================

-- Step 1: pick the canonical row for each (household_id, name, kind) group
-- (oldest by created_at, ties broken by id) and repoint any transactions
-- that referenced a duplicate to the canonical id. transactions.category_id
-- has ON DELETE SET NULL, so we MUST repoint before deleting — otherwise
-- those transactions would lose their category.
with canonical_by_key as (
  select distinct on (household_id, name, kind)
         household_id, name, kind, id as canonical_id
  from categories
  order by household_id, name, kind, created_at asc, id asc
)
update transactions t
set category_id = c.canonical_id
from categories cat
join canonical_by_key c
  on c.household_id = cat.household_id
  and c.name = cat.name
  and c.kind = cat.kind
where t.category_id = cat.id
  and cat.id <> c.canonical_id;

-- Step 2: delete the non-canonical rows
delete from categories
where id not in (
  select distinct on (household_id, name, kind) id
  from categories
  order by household_id, name, kind, created_at asc, id asc
);

-- Step 3: prevent it from happening again
alter table categories
  add constraint categories_household_name_kind_unique
  unique (household_id, name, kind);
