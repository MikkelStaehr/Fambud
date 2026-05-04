-- SECURITY: Path 2 i handle_new_user (auto-link via email-match) tillod
-- en angriber at "pre-claime" en fremmed persons email i sin egen
-- husstand. Når den person senere signede op blev de uden samtykke
-- linket til angriberens husstand og deres data var synlige for
-- angriberen.
--
-- Vi fjerner Path 2 helt. Pre-godkendelse af et familiemedlem foregår
-- nu udelukkende via invite-kode (Path 1) - ejeren skal sende et
-- /join/[CODE]-link til familiemedlemmet, der så signer op med koden.
--
-- Konsekvens for eksisterende data: rækker i family_members med email
-- sat og user_id IS NULL (gamle pre-godkendte) auto-claim'es ikke
-- længere ved signup. Ejer skal generere et invite-link og sende det
-- til familiemedlemmet. Path 1 nedenfor er opdateret til at adoptere
-- en eksisterende pre-godkendelse-række i target-husstanden i stedet
-- for at indsætte en duplikeret række.
--
-- Vi skifter også unique-email-indekset fra GLOBAL til (household_id,
-- email). Det:
-- - Tillader at samme email ER pre-godkendt i flere husstande (uden
--   sikkerhedsbetydning, fordi ingen auto-link sker længere)
-- - Bevarer beskyttelse mod duplikater INDENFOR samme husstand

-- 1. Drop global unique-email-indeks
drop index if exists public.family_members_email_unique;

-- 2. Per-household unique på email
create unique index if not exists family_members_email_per_household_unique
  on public.family_members (household_id, email)
  where email is not null;

-- 3. Genskriv handle_new_user UDEN Path 2.
--    Path 1 opgraderes til at claim'e eksisterende pre-godkendelse-rækker
--    i target-husstanden (matchet via email) i stedet for blindt at
--    INSERTE - så vi undgår per-household unique-collision.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_code_raw text;
  invite_record record;
  matched_fm_id uuid;
  new_household_id uuid;
  next_pos int;
  display_name text;
  v_home_addr text;
  v_home_zip text;
  v_home_city text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(new.email::text, '@', 1), ''),
    'Bruger'
  );
  v_home_addr := nullif(trim(new.raw_user_meta_data ->> 'home_address'), '');
  v_home_zip  := nullif(trim(new.raw_user_meta_data ->> 'home_zip_code'), '');
  v_home_city := nullif(trim(new.raw_user_meta_data ->> 'home_city'), '');

  -- Path 1: invite code (med eksplicit consent fra inviteren)
  invite_code_raw := new.raw_user_meta_data ->> 'invite_code';
  if invite_code_raw is not null and length(invite_code_raw) > 0 then
    -- FOR UPDATE låser invite-rækken så to samtidige signups med samme
    -- kode ikke begge kan succeed'e (race-condition fix, L4).
    select * into invite_record
    from public.household_invites
    where code = upper(invite_code_raw)
      and used_at is null
      and (expires_at is null or expires_at > now())
    limit 1
    for update;

    if invite_record.id is null then
      raise exception 'Invalid or expired invite code';
    end if;

    -- Hvis ejeren har pre-godkendt denne email i target-husstanden,
    -- adopterer vi den eksisterende række (sætter user_id, joined_at).
    -- Ellers indsætter vi en ny række.
    select id into matched_fm_id
    from public.family_members
    where household_id = invite_record.household_id
      and email = new.email::citext
      and user_id is null
    limit 1;

    if matched_fm_id is not null then
      update public.family_members
      set user_id = new.id,
          joined_at = now(),
          name = coalesce(nullif(name, ''), display_name),
          home_address  = coalesce(home_address,  v_home_addr),
          home_zip_code = coalesce(home_zip_code, v_home_zip),
          home_city     = coalesce(home_city,     v_home_city)
      where id = matched_fm_id;
    else
      select coalesce(max(position), -1) + 1
        into next_pos
        from public.family_members
        where household_id = invite_record.household_id;

      insert into public.family_members (
        household_id, name, user_id, role, email, joined_at, position,
        home_address, home_zip_code, home_city
      ) values (
        invite_record.household_id,
        display_name,
        new.id,
        'member',
        new.email::citext,
        now(),
        next_pos,
        v_home_addr, v_home_zip, v_home_city
      );
    end if;

    update public.household_invites
    set used_at = now(), used_by = new.id
    where id = invite_record.id;

    return new;
  end if;

  -- Path 2 (email pre-approval auto-link) FJERNET af sikkerhedshensyn.
  -- En bruger uden invite-kode oprettes altid med sin egen husstand.

  -- Path 3: brand-new household
  insert into public.households (name)
  values (coalesce(new.raw_user_meta_data ->> 'household_name', 'Min husstand'))
  returning id into new_household_id;

  insert into public.family_members (
    household_id, name, user_id, role, email, joined_at, position,
    home_address, home_zip_code, home_city
  ) values (
    new_household_id,
    display_name,
    new.id,
    'owner',
    new.email::citext,
    now(),
    0,
    v_home_addr, v_home_zip, v_home_city
  );

  return new;
end;
$$;
