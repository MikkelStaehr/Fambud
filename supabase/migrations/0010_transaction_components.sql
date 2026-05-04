-- ============================================================================
-- 0010 - transaction_components: break a recurring expense into named parts
-- ----------------------------------------------------------------------------
-- A single transaction (e.g. "Mobilabonnement (Telia) 599 kr/md") often
-- bundles distinct sub-charges - basic plan + premium license + Spotify
-- family + news subscription. Same withdrawal, same date, but the user
-- wants to see what makes up the total.
--
-- Same pattern fits a realkredit-afdrag: hovedstol-afdrag + rente +
-- bidragssats are all parts of one monthly payment.
--
-- Components don't have their own cashflow - they inherit recurrence and
-- occurs_on from the parent transaction. They're purely informational
-- decomposition, surfaced in the /budget right-side list under each
-- expense.
--
-- We don't enforce that components sum to the parent amount. Real life:
-- users often track only the "interesting" parts (rente + bidrag) and skip
-- the obvious one (afdrag).
-- ============================================================================

create table transaction_components (
  id uuid primary key default gen_random_uuid(),
  -- Denormalised household_id so RLS can scope without joining transactions
  -- on every row check.
  household_id uuid not null references households(id) on delete cascade,
  transaction_id uuid not null references transactions(id) on delete cascade,
  label text not null,
  amount bigint not null check (amount >= 0),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index transaction_components_transaction_idx
  on transaction_components(transaction_id);

alter table transaction_components enable row level security;

-- Household-scoped only - we don't gate on can_write_account here. If you
-- can see a transaction (member of the household), you can add/remove its
-- components. Tightening to a per-account write check would require joining
-- through transactions on every policy evaluation; the looser policy is
-- consistent with how we handle settings/categories where members trust
-- each other to manage shared data.
create policy "members all components"
  on transaction_components for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
