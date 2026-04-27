-- ============================================================================
-- 0003 — Per-account write permissions + wizard completion flag
-- ----------------------------------------------------------------------------
-- Two changes:
--   1. Each account gets editable_by_all + created_by. The default is "any
--      household member can edit" (matches the common case where one person
--      handles all bookkeeping). Setting editable_by_all=false restricts
--      writes — and writes to transactions/transfers that touch the account
--      — to the creator only. Reads stay open to all members.
--   2. household_members gains setup_completed_at. The wizard sets it when
--      onboarding finishes; until then the (app) layout redirects to /wizard.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- accounts: editable_by_all + created_by
-- ----------------------------------------------------------------------------
alter table accounts
  add column editable_by_all boolean not null default true,
  add column created_by uuid references auth.users(id) on delete set null;

-- Backfill: any account from before this migration belongs to the household
-- owner. This keeps existing rows editable for that user under the new policy.
update accounts a
set created_by = (
  select hm.user_id from household_members hm
  where hm.household_id = a.household_id and hm.role = 'owner'
  limit 1
)
where created_by is null;

-- BEFORE INSERT trigger to auto-set created_by from auth.uid() if the app
-- forgets to send it. Belt-and-braces — the action sets it explicitly, but
-- this guarantees the column is never NULL on a freshly inserted row.
create or replace function public.set_account_created_by()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger set_account_created_by_trigger
before insert on accounts
for each row execute function public.set_account_created_by();

-- ----------------------------------------------------------------------------
-- can_write_account() — the central permission predicate
-- ----------------------------------------------------------------------------
-- True if the caller is allowed to mutate the given account or any row that
-- references it (transactions, transfers). SECURITY DEFINER so the inner
-- account-lookup bypasses RLS — otherwise we'd need a SELECT policy that
-- mirrors this exact logic, which would be circular.
create or replace function public.can_write_account(account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.accounts a
    where a.id = account_id
      and public.is_household_member(a.household_id)
      and (a.editable_by_all or a.created_by = auth.uid())
  );
$$;

-- ----------------------------------------------------------------------------
-- household_members.setup_completed_at
-- ----------------------------------------------------------------------------
alter table household_members
  add column setup_completed_at timestamptz;
-- Existing members keep NULL → they'll go through the wizard once. That's
-- intentional for the test user; if you want to skip them, run:
--   update household_members set setup_completed_at = now()
--   where setup_completed_at is null;

-- ============================================================================
-- RLS rewrite
-- ----------------------------------------------------------------------------
-- We replace the broad "members all X" policies with split read/write policies.
-- Read stays open to all household members. Write is gated by
-- can_write_account() for transactions/transfers, and by editable_by_all OR
-- created_by for accounts themselves.
-- ============================================================================

-- accounts
drop policy "members all accounts" on accounts;

create policy "members read accounts"
  on accounts for select
  using (public.is_household_member(household_id));

create policy "members insert accounts"
  on accounts for insert
  with check (public.is_household_member(household_id));

create policy "writable update accounts"
  on accounts for update
  using (
    public.is_household_member(household_id)
    and (editable_by_all or created_by = auth.uid())
  )
  with check (
    public.is_household_member(household_id)
    and (editable_by_all or created_by = auth.uid())
  );

create policy "writable delete accounts"
  on accounts for delete
  using (
    public.is_household_member(household_id)
    and (editable_by_all or created_by = auth.uid())
  );

-- transactions
drop policy "members all transactions" on transactions;

create policy "members read transactions"
  on transactions for select
  using (public.is_household_member(household_id));

create policy "writable insert transactions"
  on transactions for insert
  with check (
    public.is_household_member(household_id)
    and public.can_write_account(account_id)
  );

create policy "writable update transactions"
  on transactions for update
  using (
    public.is_household_member(household_id)
    and public.can_write_account(account_id)
  )
  with check (
    public.is_household_member(household_id)
    and public.can_write_account(account_id)
  );

create policy "writable delete transactions"
  on transactions for delete
  using (
    public.is_household_member(household_id)
    and public.can_write_account(account_id)
  );

-- transfers — write requires can_write_account on BOTH sides
drop policy "members all transfers" on transfers;

create policy "members read transfers"
  on transfers for select
  using (public.is_household_member(household_id));

create policy "writable insert transfers"
  on transfers for insert
  with check (
    public.is_household_member(household_id)
    and public.can_write_account(from_account_id)
    and public.can_write_account(to_account_id)
  );

create policy "writable update transfers"
  on transfers for update
  using (
    public.is_household_member(household_id)
    and public.can_write_account(from_account_id)
    and public.can_write_account(to_account_id)
  )
  with check (
    public.is_household_member(household_id)
    and public.can_write_account(from_account_id)
    and public.can_write_account(to_account_id)
  );

create policy "writable delete transfers"
  on transfers for delete
  using (
    public.is_household_member(household_id)
    and public.can_write_account(from_account_id)
    and public.can_write_account(to_account_id)
  );
