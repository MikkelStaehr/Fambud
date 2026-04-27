-- ============================================================================
-- 0013 — Rename 'Streaming' category to 'Medie'
-- ----------------------------------------------------------------------------
-- 'Medie' is a slightly broader bucket: streaming + Yousee/Stofa-style
-- TV-pakker + aviser/podcasts. Fits the household's mental model better
-- than the narrow 'Streaming'.
--
-- Two-step rename so we don't trip the UNIQUE(household_id, name, kind)
-- constraint if a household happened to already create a custom 'Medie'
-- category. In that case we repoint Streaming's transactions to the
-- existing Medie and drop the Streaming row.
-- ============================================================================

-- Repoint transactions from 'Streaming' to 'Medie' in households where both
-- already exist (rare, but possible if user pre-created a custom 'Medie').
update transactions t
set category_id = m.id
from categories s
join categories m
  on m.household_id = s.household_id
  and m.name = 'Medie'
  and m.kind = 'expense'
where t.category_id = s.id
  and s.name = 'Streaming'
  and s.kind = 'expense';

-- Drop the now-orphan 'Streaming' rows in households that already had 'Medie'.
delete from categories c
where c.name = 'Streaming'
  and c.kind = 'expense'
  and exists (
    select 1 from categories m
    where m.household_id = c.household_id
      and m.name = 'Medie'
      and m.kind = 'expense'
  );

-- For all other households (the common case), straight rename.
update categories
set name = 'Medie'
where name = 'Streaming'
  and kind = 'expense';
