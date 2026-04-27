-- ============================================================================
-- 0014 — Family members + per-member tagging on expenses & components
-- ----------------------------------------------------------------------------
-- household_members tracks USERS who can log in. family_members is the
-- broader concept: everyone in the family, with or without a login. Kids
-- and dependents fit here too. The optional user_id links a family_member
-- to their auth account if they have one.
--
-- Tagging:
--   - transactions.family_member_id: when a whole expense belongs to one
--     person (e.g. "Theodors daginstitution").
--   - transaction_components.family_member_id: when a single bill is split
--     across people (e.g. Ulykke-forsikring with components for Louise,
--     Theodor, Mikkel).
--
-- Both are nullable. NULL = "applies to the household" (default).
-- ON DELETE SET NULL on the FKs so deleting a family member doesn't break
-- referential integrity — transactions just lose their tag.
-- ============================================================================

create table if not exists family_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  birthdate date,
  -- Optional link to the auth user if this family member is also a logged-in
  -- household_member. ON DELETE SET NULL because deleting the auth user
  -- shouldn't delete the family record (the person still exists in the
  -- household, just without a login).
  user_id uuid references auth.users(id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists family_members_household_idx
  on family_members(household_id);

alter table family_members enable row level security;

create policy "members manage family"
  on family_members for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Tag fields on the two places where per-member attribution makes sense.
alter table transactions
  add column if not exists family_member_id uuid
  references family_members(id) on delete set null;

alter table transaction_components
  add column if not exists family_member_id uuid
  references family_members(id) on delete set null;
