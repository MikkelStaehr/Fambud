-- Sikkerheds-hotfix der lukker tre huller fundet i 2. round audit:
--
-- 1. NEW-C2: check_transaction_category_household kører som invokerings-
--    rolle. Når en angriber sætter category_id til en kategori i en
--    fremmed husstand, er den blokeret af RLS for vores caller, så
--    SELECT returnerer ingen rækker, cat_household_id ender NULL, og
--    "is not null and != household_id"-tjekket evaluerer til false ->
--    INSERT slipper igennem. Fixet: SECURITY DEFINER på funktionen
--    (så den kan læse på tværs af RLS) PLUS NULL behandles som fail.
--
-- 2. NEW-H4: handle_new_user trigger trustede client-kontrolleret
--    raw_user_meta_data uden length-cap. En angriber kunne kalde
--    supabase.auth.signUp direkte fra browser-devtools med
--    full_name = 'A'.repeat(50_000_000) og bloate vores DB.
--    Fixet: cap'pede left()-kald i trigger-koden.
--
-- 3. Bonus: M7-udvidelse - tilføj samme household-consistency trigger
--    for transfers (from_account_id og to_account_id).
--    Trigger gør samme NULL-as-fail-pattern som vi skifter
--    categories-triggeren over på.

-- ============================================================================
-- 1. NEW-C2: categories trigger SECURITY DEFINER + NULL-as-fail
-- ============================================================================
create or replace function public.check_transaction_category_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cat_household_id uuid;
begin
  if new.category_id is null then
    return new;
  end if;
  -- SECURITY DEFINER så vi kan læse categories på tværs af RLS.
  -- Uden det ville en cross-household reference resultere i en
  -- RLS-blokeret SELECT der returnerer 0 rækker -> cat_household_id
  -- ender NULL -> tidligere check missede den.
  select household_id into cat_household_id
  from public.categories
  where id = new.category_id;
  -- NULL behandles som fail (kategorien findes ikke / er i en
  -- husstand vi ikke kunne læse - begge tilfælde betyder afvis).
  if cat_household_id is null or cat_household_id <> new.household_id then
    raise exception 'category does not belong to this household'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Samme defensiv-pattern på components-triggeren (den havde allerede
-- NULL-fail logik, men SECURITY DEFINER er konsistent og dækker
-- også hvis transactions-RLS i fremtiden blokerer SELECT).
create or replace function public.check_component_transaction_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tx_household_id uuid;
begin
  select household_id into tx_household_id
  from public.transactions
  where id = new.transaction_id;
  if tx_household_id is null then
    raise exception 'parent transaction not found'
      using errcode = 'foreign_key_violation';
  end if;
  if tx_household_id <> new.household_id then
    raise exception 'component household does not match parent transaction household'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 2. M7-udvidelse: transfers from/to-account samme household
-- ============================================================================
create or replace function public.check_transfer_account_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  from_household uuid;
  to_household uuid;
begin
  select household_id into from_household
  from public.accounts where id = new.from_account_id;
  select household_id into to_household
  from public.accounts where id = new.to_account_id;
  if from_household is null or to_household is null then
    raise exception 'account not found'
      using errcode = 'foreign_key_violation';
  end if;
  if from_household <> new.household_id or to_household <> new.household_id then
    raise exception 'transfer accounts must belong to the same household'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists check_transfer_account_household on public.transfers;
create trigger check_transfer_account_household
  before insert or update of from_account_id, to_account_id, household_id on public.transfers
  for each row execute function public.check_transfer_account_household();

-- ============================================================================
-- 3. NEW-H4: cap længde i handle_new_user trigger
-- ============================================================================
-- En angriber kunne tidligere kalde supabase.auth.signUp direkte med
-- raw_user_meta_data som var 50 MB store strings - vores trigger
-- inserterede dem rå i family_members.name / households.name.
-- Vi cap'per nu i triggeren selv som defense-in-depth.
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
  v_household_name text;
begin
  -- Cap alle felter til fornuftige længder. Postgres text-kolonner har
  -- ingen indbygget grænse, og raw_user_meta_data kommer direkte fra
  -- klienten (kan kaldes via supabase.auth.signUp uden vores action).
  display_name := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(new.email::text, '@', 1), ''),
    'Bruger'
  ), 100);
  v_home_addr := left(nullif(trim(new.raw_user_meta_data ->> 'home_address'), ''), 200);
  v_home_zip  := left(nullif(trim(new.raw_user_meta_data ->> 'home_zip_code'), ''), 20);
  v_home_city := left(nullif(trim(new.raw_user_meta_data ->> 'home_city'), ''), 100);
  v_household_name := left(coalesce(new.raw_user_meta_data ->> 'household_name', 'Min husstand'), 100);

  -- Path 1: invite code (med eksplicit consent fra inviteren)
  invite_code_raw := new.raw_user_meta_data ->> 'invite_code';
  if invite_code_raw is not null and length(invite_code_raw) > 0 and length(invite_code_raw) <= 32 then
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

  -- Path 3: brand-new household (Path 2 fjernet i 0043 af sikkerhed)
  insert into public.households (name)
  values (v_household_name)
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
