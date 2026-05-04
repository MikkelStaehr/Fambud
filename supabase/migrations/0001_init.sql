-- ============================================================================
-- Fambud - initial schema
-- ----------------------------------------------------------------------------
-- Money is stored as integer øre (1/100 DKK) in bigint columns.
-- Reason: the cashflow forecast in a later milestone will sum hundreds of
-- recurring entries; integer math avoids the float drift you get with numeric
-- when the same expansion is summed many ways. Helper formatDKK(øre) lives
-- in lib/format.ts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type account_kind as enum ('checking', 'savings', 'credit', 'cash', 'other');
create type category_kind as enum ('income', 'expense');
-- recurrence is scaffolded now so the forecast turn doesn't need a migration.
create type recurrence_freq as enum ('once', 'weekly', 'monthly', 'yearly');

-- ----------------------------------------------------------------------------
-- Households + membership
-- ----------------------------------------------------------------------------
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Min husstand',
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_idx on household_members(user_id);

-- ----------------------------------------------------------------------------
-- Accounts
-- ----------------------------------------------------------------------------
create table accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  -- Free-form label like 'Mikkel', 'Anna' or 'Fælles'. Not a FK; accounts can
  -- be jointly owned and the label may not match a household_member name.
  owner_name text,
  kind account_kind not null default 'checking',
  opening_balance bigint not null default 0,
  currency char(3) not null default 'DKK',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index accounts_household_idx on accounts(household_id);

-- ----------------------------------------------------------------------------
-- Categories
-- ----------------------------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  kind category_kind not null,
  color text not null default '#94a3b8',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index categories_household_idx on categories(household_id);

-- ----------------------------------------------------------------------------
-- Transactions ("poster")
-- ----------------------------------------------------------------------------
-- amount is always a positive bigint; the sign in the cashflow comes from the
-- category kind (income vs expense). Storing unsigned avoids ambiguity when
-- swapping categories on an existing transaction.
create table transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete restrict,
  category_id uuid references categories(id) on delete set null,
  amount bigint not null check (amount >= 0),
  description text,
  occurs_on date not null,
  recurrence recurrence_freq not null default 'once',
  recurrence_until date,
  created_at timestamptz not null default now()
);

create index transactions_household_date_idx on transactions(household_id, occurs_on);
create index transactions_account_idx on transactions(account_id);

-- ----------------------------------------------------------------------------
-- Transfers ("overførsler")
-- ----------------------------------------------------------------------------
create table transfers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  from_account_id uuid not null references accounts(id) on delete restrict,
  to_account_id uuid not null references accounts(id) on delete restrict,
  amount bigint not null check (amount > 0),
  description text,
  occurs_on date not null,
  recurrence recurrence_freq not null default 'once',
  recurrence_until date,
  created_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);

create index transfers_household_date_idx on transfers(household_id, occurs_on);

-- ============================================================================
-- Auth trigger: auto-create a household for every new auth user.
-- Lets us run the entire signup flow without a service-role key on the server.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  insert into public.households (name)
  values (coalesce(new.raw_user_meta_data ->> 'household_name', 'Min husstand'))
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================================
-- Row-level security
-- ----------------------------------------------------------------------------
-- The is_household_member() helper is SECURITY DEFINER so its inner select on
-- household_members runs with the function-owner's privileges, bypassing RLS.
-- That avoids policy recursion when household_members itself has policies that
-- reference is_household_member().
-- ============================================================================
alter table households enable row level security;
alter table household_members enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table transfers enable row level security;

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- households
create policy "members read household"
  on households for select using (public.is_household_member(id));
create policy "members update household"
  on households for update using (public.is_household_member(id));

-- household_members
-- A user can always read their own membership row; they can also read other
-- members of any household they belong to (so the UI can show the family).
create policy "self or fellow read membership"
  on household_members for select
  using (user_id = auth.uid() or public.is_household_member(household_id));

-- accounts / categories / transactions / transfers - same household-scoped rule
create policy "members all accounts"
  on accounts for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members all categories"
  on categories for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members all transactions"
  on transactions for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members all transfers"
  on transfers for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
