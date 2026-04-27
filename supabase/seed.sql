-- ============================================================================
-- Fambud — seed data
-- ----------------------------------------------------------------------------
-- Run this AFTER signing up your first user in the app. The signup trigger
-- creates an empty household; this script populates it with sample accounts,
-- categories and transactions so the dashboard has something to show.
--
-- Edit `target_email` below before running. Safe to re-run only on an empty
-- household — it will just append duplicates otherwise.
-- ============================================================================

do $$
declare
  target_email constant text := 'you@example.com';

  v_user_id uuid;
  v_household_id uuid;

  v_acc_lon uuid;
  v_acc_budget uuid;
  v_acc_opsparing uuid;

  v_cat_loen uuid;
  v_cat_husleje uuid;
  v_cat_dagligvarer uuid;
  v_cat_transport uuid;
  v_cat_underholdning uuid;
begin
  -- Supabase normalises email to lowercase on signup; compare case-insensitively
  -- so seeding works regardless of how the email is spelled in target_email.
  select id into v_user_id from auth.users where lower(email) = lower(target_email);
  if v_user_id is null then
    raise exception 'User % not found. Sign up in the app first.', target_email;
  end if;

  select household_id into v_household_id
  from public.household_members where user_id = v_user_id limit 1;
  if v_household_id is null then
    raise exception 'No household for %. The auth trigger should have created one.', target_email;
  end if;

  -- Accounts (opening_balance is in øre — 1.245.000 øre = 12.450,00 kr)
  insert into public.accounts (household_id, name, owner_name, kind, opening_balance)
  values (v_household_id, 'Lønkonto',     'Mikkel', 'checking', 1245000)
  returning id into v_acc_lon;

  insert into public.accounts (household_id, name, owner_name, kind, opening_balance)
  values (v_household_id, 'Budgetkonto',  'Fælles', 'checking',  875000)
  returning id into v_acc_budget;

  insert into public.accounts (household_id, name, owner_name, kind, opening_balance)
  values (v_household_id, 'Opsparing',    'Fælles', 'savings',  5000000)
  returning id into v_acc_opsparing;

  -- Categories
  insert into public.categories (household_id, name, kind, color)
    values (v_household_id, 'Løn',           'income',  '#22c55e') returning id into v_cat_loen;
  insert into public.categories (household_id, name, kind, color)
    values (v_household_id, 'Husleje',       'expense', '#ef4444') returning id into v_cat_husleje;
  insert into public.categories (household_id, name, kind, color)
    values (v_household_id, 'Dagligvarer',   'expense', '#f59e0b') returning id into v_cat_dagligvarer;
  insert into public.categories (household_id, name, kind, color)
    values (v_household_id, 'Transport',     'expense', '#3b82f6') returning id into v_cat_transport;
  insert into public.categories (household_id, name, kind, color)
    values (v_household_id, 'Underholdning', 'expense', '#a855f7') returning id into v_cat_underholdning;

  -- A handful of transactions — recurrence is set so the forecast turn has data to chew on.
  insert into public.transactions
    (household_id, account_id,      category_id,           amount,  description,   occurs_on,                                          recurrence)
  values
    (v_household_id, v_acc_lon,     v_cat_loen,           3500000, 'Månedsløn',    date_trunc('month', current_date)::date,           'monthly'),
    (v_household_id, v_acc_budget,  v_cat_husleje,        1200000, 'Husleje',      (date_trunc('month', current_date) + interval '1 day')::date, 'monthly'),
    (v_household_id, v_acc_budget,  v_cat_dagligvarer,      75000, 'Netto',        current_date - 2,                                   'once'),
    (v_household_id, v_acc_budget,  v_cat_transport,        35000, 'Rejsekort',    current_date - 5,                                   'once'),
    (v_household_id, v_acc_budget,  v_cat_underholdning,    12900, 'Spotify',      current_date - 7,                                   'monthly');
end $$;
