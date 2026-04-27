-- ============================================================================
-- 0009 — Merge 'A-kasse' + 'Fagforening' into 'A-kasse & Fagforening'
-- ----------------------------------------------------------------------------
-- The two categories are paid as one expense by most users (FOA, 3F, HK, …
-- bundle them on a single bill), so keeping them separate makes the dropdown
-- noisier than helpful. Combine into one category and migrate any existing
-- transactions over.
--
-- This relies on the UNIQUE (household_id, name, kind) constraint from 0008
-- for the ON CONFLICT clause.
-- ============================================================================

-- Step 1: ensure 'A-kasse & Fagforening' exists for every household that
-- had one or both of the old categories. ON CONFLICT DO NOTHING handles the
-- case where it somehow already exists.
insert into categories (household_id, name, kind, color)
select distinct household_id,
                'A-kasse & Fagforening' as name,
                'expense'::category_kind as kind,
                '#0ea5e9' as color
from categories
where name in ('A-kasse', 'Fagforening')
  and kind = 'expense'
on conflict (household_id, name, kind) do nothing;

-- Step 2: repoint transactions from the old categories to the combined one.
-- transactions.category_id has ON DELETE SET NULL, so we MUST repoint before
-- deleting — otherwise those transactions would lose their category.
update transactions t
set category_id = combined.id
from categories combined
join categories old
  on old.household_id = combined.household_id
  and old.kind = 'expense'
  and old.name in ('A-kasse', 'Fagforening')
where combined.name = 'A-kasse & Fagforening'
  and combined.kind = 'expense'
  and t.category_id = old.id;

-- Step 3: delete the old rows
delete from categories
where name in ('A-kasse', 'Fagforening')
  and kind = 'expense';
