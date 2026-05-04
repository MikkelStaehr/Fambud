-- Migration 0034: udvid handle_new_user-triggeren så den henter
-- full_name og home_address fra signup-metadata.
--
-- Tidligere brugte vi email's localpart som display_name (fx "anders" fra
-- "anders@hansen.dk") fordi vi ikke spurgte om et rigtigt navn ved signup.
-- Nu kan brugeren angive både fuldt navn og bopælsadresse i signup-formen.
-- Hvis ikke angivet falder vi tilbage til email-localpart for navnet og
-- null for adressen.
--
-- Begge felter ankommer via supabase.auth.signUp({ data: {...} }) →
-- raw_user_meta_data. Triggeren læser dem ved INSERT på auth.users og
-- forfremmer dem til family_members-rækken.

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
  home_addr text;
begin
  -- Læs full_name og home_address fra metadata; fald tilbage til email-
  -- localpart for navnet hvis ikke angivet.
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(new.email::text, '@', 1), ''),
    'Bruger'
  );
  home_addr := nullif(trim(new.raw_user_meta_data ->> 'home_address'), '');

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
      household_id, name, user_id, role, email, joined_at, position, home_address
    ) values (
      invite_record.household_id,
      display_name,
      new.id,
      'member',
      new.email::citext,
      now(),
      next_pos,
      home_addr
    );

    update public.household_invites
    set used_at = now(), used_by = new.id
    where id = invite_record.id;

    return new;
  end if;

  -- Path 2: email pre-approval - partner er allerede oprettet af owner
  -- via /wizard/familie. Vi opdaterer den eksisterende række med
  -- user_id, role og home_address (hvis ikke allerede sat) men holder
  -- name fra owner's pre-fyld.
  select * into matched_fm
  from public.family_members
  where email = new.email::citext
    and user_id is null
  limit 1;

  if matched_fm.id is not null then
    update public.family_members
    set user_id = new.id,
        role = coalesce(role, 'member'),
        joined_at = now(),
        home_address = coalesce(home_address, home_addr)
    where id = matched_fm.id;

    return new;
  end if;

  -- Path 3: brand-new household
  insert into public.households (name)
  values (coalesce(new.raw_user_meta_data ->> 'household_name', 'Min husstand'))
  returning id into new_household_id;

  insert into public.family_members (
    household_id, name, user_id, role, email, joined_at, position, home_address
  ) values (
    new_household_id,
    display_name,
    new.id,
    'owner',
    new.email::citext,
    now(),
    0,
    home_addr
  );

  return new;
end;
$$;
