-- ============================================================================
-- 0002 — Invite codes + savings goals
-- ----------------------------------------------------------------------------
-- Two independent changes packaged together because we ship them in one turn:
--   1. accounts gain optional goal_amount/goal_date/goal_label so any account
--      kind can carry a target (a checking-account buffer, a savings target,
--      …). UI for editing comes with the CRUD turn.
--   2. household_invites + reworked auth trigger so users only join an
--      existing household via a one-shot invite code. Without a code, signup
--      keeps the 0001 behaviour: a new household is auto-created.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- accounts: savings-goal columns
-- ----------------------------------------------------------------------------
alter table accounts
  add column goal_amount bigint check (goal_amount is null or goal_amount > 0),
  add column goal_date date,
  add column goal_label text;

-- ----------------------------------------------------------------------------
-- generate_invite_code()
-- ----------------------------------------------------------------------------
-- 8-char codes from a 31-char alphabet (no 0/O/1/I/L/letter-confusables) →
-- ~27 billion combinations. We don't retry on collision — at solo-dev volumes
-- we will never see one. Defined before household_invites so the table can
-- use it as a column default.
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return result;
end;
$$;

-- ----------------------------------------------------------------------------
-- household_invites
-- ----------------------------------------------------------------------------
create table household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  code text not null unique default public.generate_invite_code(),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  -- used_by has no meaning without used_at — keep them in lockstep.
  check ((used_at is null) = (used_by is null))
);

create index household_invites_code_idx
  on household_invites(code) where used_at is null;
create index household_invites_household_idx
  on household_invites(household_id);

alter table household_invites enable row level security;

-- Members of the household can list, create, cancel invites for their household.
create policy "members manage invites"
  on household_invites for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ----------------------------------------------------------------------------
-- validate_invite_code(code)
-- ----------------------------------------------------------------------------
-- Unauth-callable lookup for the /join/[code] page. Returns (valid,
-- household_name) without leaking the household ID. SECURITY DEFINER so anon
-- can call it despite RLS on household_invites + households.
-- ----------------------------------------------------------------------------
create or replace function public.validate_invite_code(code_input text)
returns table (valid boolean, household_name text)
language sql
stable
security definer
set search_path = public
as $$
  select
    (i.id is not null) as valid,
    h.name as household_name
  from public.household_invites i
  left join public.households h on h.id = i.household_id
  where i.code = upper(code_input)
    and i.used_at is null
    and (i.expires_at is null or i.expires_at > now())
  union all
  select false, null
  where not exists (
    select 1 from public.household_invites
    where code = upper(code_input)
      and used_at is null
      and (expires_at is null or expires_at > now())
  )
  limit 1;
$$;

grant execute on function public.validate_invite_code(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- get_household_members(hid)
-- ----------------------------------------------------------------------------
-- The settings page wants to show member emails, but auth.users is not
-- accessible via RLS. SECURITY DEFINER function joins it server-side; the
-- inner is_household_member() check enforces that only members of the asked
-- household get the answer.
-- ----------------------------------------------------------------------------
create or replace function public.get_household_members(hid uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select hm.user_id, u.email::text, hm.role, hm.joined_at
  from public.household_members hm
  join auth.users u on u.id = hm.user_id
  where hm.household_id = hid
    and public.is_household_member(hid)
  order by hm.joined_at;
$$;

grant execute on function public.get_household_members(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Auth trigger — replace function (the trigger from 0001 keeps pointing here)
-- ----------------------------------------------------------------------------
-- Behaviour:
--  - If raw_user_meta_data.invite_code is set: validate the code, add the new
--    user as 'member' to the invited household, mark the code used.
--  - Otherwise: legacy 0001 behaviour — create a new household and add as
--    'owner'.
-- An invalid invite code raises an exception, which propagates back through
-- supabase.auth.signUp() so the signup action can surface the failure.
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
  new_household_id uuid;
begin
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

    insert into public.household_members (household_id, user_id, role)
    values (invite_record.household_id, new.id, 'member');

    update public.household_invites
    set used_at = now(), used_by = new.id
    where id = invite_record.id;
  else
    insert into public.households (name)
    values (coalesce(new.raw_user_meta_data ->> 'household_name', 'Min husstand'))
    returning id into new_household_id;

    insert into public.household_members (household_id, user_id, role)
    values (new_household_id, new.id, 'owner');
  end if;

  return new;
end;
$$;
