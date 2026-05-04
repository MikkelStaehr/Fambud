-- ============================================================================
-- 0015 - Single source of truth: drop household_members, extend family_members
-- ----------------------------------------------------------------------------
-- Today we have two parallel concepts of "person":
--   - household_members: auth users that can log in (Mikkel, Louise)
--   - family_members:    everyone in the family (Mikkel, Louise, Theo)
--
-- They overlap for adults and split for kids. That dualism leaks into the UI
-- (two sections in /indstillinger), into the DAL (two reads), and into the
-- mental model (which table do I tag an expense from?). It also means there
-- is no obvious place to pre-approve a partner's email so signup auto-joins
-- the household.
--
-- This migration unifies them. After it runs:
--   - family_members is the only "person" table.
--   - A row with user_id IS NOT NULL is a logged-in member.
--   - A row with user_id IS NULL and email IS NOT NULL is pre-approved -
--     the signup trigger claims it on auth.user creation.
--   - A row with both NULL is a dependent (Theo): just a tag for expenses.
--   - household_members is dropped.
--
-- All RLS policies on every other table reach household membership via
-- is_household_member(hid). We rewrite that one function to read from
-- family_members, so the dozen policies that depend on it pick up the
-- new source automatically.
-- ============================================================================

-- citext gives us case-insensitive equality on emails without lower() everywhere.
create extension if not exists citext;

-- ----------------------------------------------------------------------------
-- 1. Extend family_members with everything household_members carried
-- ----------------------------------------------------------------------------
alter table family_members
  add column if not exists email citext,
  add column if not exists role text,
  add column if not exists setup_completed_at timestamptz,
  add column if not exists joined_at timestamptz;

-- role is only meaningful when user_id is set. We allow NULL for dependents.
alter table family_members
  drop constraint if exists family_members_role_check;
alter table family_members
  add constraint family_members_role_check
  check (role is null or role in ('owner', 'member'));

-- One auth user can only be one family_member (per household, but in practice
-- per the whole table since users belong to one household). Partial index so
-- multiple dependents with NULL user_id are still allowed.
create unique index if not exists family_members_user_id_unique
  on family_members(user_id) where user_id is not null;

-- Email pre-approval must be globally unique - when an auth.users row is
-- created with email X, the trigger needs an unambiguous family_member to
-- claim. citext makes this case-insensitive.
create unique index if not exists family_members_email_unique
  on family_members(email) where email is not null;

-- ----------------------------------------------------------------------------
-- 2. Backfill family_members from household_members + auth.users
-- ----------------------------------------------------------------------------
-- For each household_members row we either:
--   (a) update an existing family_members row that already points at this
--       user_id  (the common case if the user manually added themselves to
--       the family list and we can find them by user_id), OR
--   (b) insert a fresh family_members row with name = email-prefix so the
--       row is immediately recognisable in the UI.
--
-- We do NOT try to fuzzy-match an existing family_member with user_id=NULL
-- by name - too fragile. After this migration, if you had manually added
-- yourself with user_id=NULL, you'll see a duplicate in /indstillinger.
-- Delete the orphan one (the one without "Kan logge ind"-status); any
-- expense tags on it can be re-pointed in a single click.
-- ----------------------------------------------------------------------------
do $$
declare
  hm record;
  user_email text;
  matched_id uuid;
  next_pos int;
begin
  for hm in select * from household_members loop
    select email::text into user_email from auth.users where id = hm.user_id;

    select id into matched_id
    from family_members
    where user_id = hm.user_id
    limit 1;

    if matched_id is not null then
      update family_members
      set role = hm.role,
          setup_completed_at = hm.setup_completed_at,
          joined_at = coalesce(joined_at, hm.joined_at),
          email = coalesce(email, user_email::citext)
      where id = matched_id;
    else
      select coalesce(max(position), -1) + 1
        into next_pos
        from family_members
        where household_id = hm.household_id;

      insert into family_members (
        household_id, name, user_id, role,
        setup_completed_at, joined_at, email, position
      ) values (
        hm.household_id,
        coalesce(nullif(split_part(user_email, '@', 1), ''), 'Bruger'),
        hm.user_id,
        hm.role,
        hm.setup_completed_at,
        hm.joined_at,
        user_email::citext,
        next_pos
      );
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Rewrite is_household_member() to read from family_members
-- ----------------------------------------------------------------------------
-- This single function is what every other RLS policy across the schema
-- (accounts, categories, transactions, transfers, transaction_components,
-- household_invites, family_members, households) calls to verify membership.
-- Swap its source of truth and the rest of the schema follows automatically.
--
-- Still SECURITY DEFINER + stable so RLS on family_members itself doesn't
-- cause recursion.
-- ----------------------------------------------------------------------------
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where household_id = hid
      and user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. Rewrite handle_new_user() - adds the email-preapproval path
-- ----------------------------------------------------------------------------
-- Order of precedence at signup time:
--   1. invite_code in raw_user_meta_data → join that household, mark code used
--   2. email matches an unclaimed family_members.email → claim that row
--      (sets user_id, role='member', joined_at=now()) and you join its
--      household. This is the partner-pre-approval flow.
--   3. Otherwise → create a fresh household and add the user as 'owner'.
--
-- Path 2 is the new bit. It runs only if Path 1 didn't fire and there is
-- exactly one family_members row with that email and no user_id yet
-- (the unique index guarantees uniqueness).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_code_raw text;
  invite_record record;
  matched_fm record;
  new_household_id uuid;
  next_pos int;
  display_name text;
begin
  display_name := coalesce(
    nullif(split_part(new.email::text, '@', 1), ''),
    'Bruger'
  );

  -- Path 1: invite code
  invite_code_raw := new.raw_user_meta_data ->> 'invite_code';
  if invite_code_raw is not null and length(invite_code_raw) > 0 then
    select * into invite_record
    from public.household_invites
    where code = upper(invite_code_raw)
      and used_at is null
      and (expires_at is null or expires_at > now())
    limit 1;

    if invite_record.id is null then
      raise exception 'Invalid or expired invite code';
    end if;

    select coalesce(max(position), -1) + 1
      into next_pos
      from public.family_members
      where household_id = invite_record.household_id;

    insert into public.family_members (
      household_id, name, user_id, role, email, joined_at, position
    ) values (
      invite_record.household_id,
      display_name,
      new.id,
      'member',
      new.email::citext,
      now(),
      next_pos
    );

    update public.household_invites
    set used_at = now(), used_by = new.id
    where id = invite_record.id;

    return new;
  end if;

  -- Path 2: email pre-approval
  select * into matched_fm
  from public.family_members
  where email = new.email::citext
    and user_id is null
  limit 1;

  if matched_fm.id is not null then
    update public.family_members
    set user_id = new.id,
        role = coalesce(role, 'member'),
        joined_at = now()
    where id = matched_fm.id;

    return new;
  end if;

  -- Path 3: brand-new household
  insert into public.households (name)
  values (coalesce(new.raw_user_meta_data ->> 'household_name', 'Min husstand'))
  returning id into new_household_id;

  insert into public.family_members (
    household_id, name, user_id, role, email, joined_at, position
  ) values (
    new_household_id,
    display_name,
    new.id,
    'owner',
    new.email::citext,
    now(),
    0
  );

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Rewrite get_household_members() - only return rows that have a login
-- ----------------------------------------------------------------------------
-- The /indstillinger "members" section in the new UI will pull all
-- family_members directly via RLS. This RPC is kept for callers that still
-- want the auth-joined view (email + role) - limited to logins.
-- ----------------------------------------------------------------------------
create or replace function public.get_household_members(hid uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select fm.user_id, u.email::text, fm.role, fm.joined_at
  from public.family_members fm
  join auth.users u on u.id = fm.user_id
  where fm.household_id = hid
    and fm.user_id is not null
    and public.is_household_member(hid)
  order by fm.joined_at nulls last, fm.created_at;
$$;

-- ----------------------------------------------------------------------------
-- 6. Rewrite mark_setup_complete() to write to family_members
-- ----------------------------------------------------------------------------
create or replace function public.mark_setup_complete()
returns void
language sql
security definer
set search_path = public
as $$
  update public.family_members
  set setup_completed_at = now()
  where user_id = auth.uid()
    and setup_completed_at is null;
$$;

-- ----------------------------------------------------------------------------
-- 7. Drop household_members
-- ----------------------------------------------------------------------------
-- Drop dependent policy first, then the table. accounts.created_by references
-- auth.users(id) directly (not household_members), so it survives untouched.
-- household_invites.created_by/used_by also reference auth.users directly.
-- ----------------------------------------------------------------------------
drop policy if exists "self or fellow read membership" on household_members;
drop table if exists household_members;
