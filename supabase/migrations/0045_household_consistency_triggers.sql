-- SECURITY: Enforce household-consistency på cross-table references.
-- RLS gater hvem der kan SKRIVE til de enkelte tabeller, men ikke at
-- referencer mellem tabeller forbliver inden for samme husstand. Hvis
-- en angriber lærer en UUID fra en anden husstand (fx via screenshot,
-- log eller error message), kunne de tidligere indsætte en transaction
-- der refererer til en kategori i en fremmed husstand, eller en
-- component der refererer til en transaction i en fremmed husstand.
--
-- Vi bruger AFTER INSERT/UPDATE-triggers der validerer relationen og
-- raise'r exception hvis household_id ikke stemmer overens. RLS er
-- stadig den primære grænse - dette er defense-in-depth.

-- 1. transactions.category_id skal pege på category i samme household
create or replace function public.check_transaction_category_household()
returns trigger
language plpgsql
as $$
declare
  cat_household_id uuid;
begin
  if new.category_id is null then
    return new;
  end if;
  select household_id into cat_household_id
  from public.categories
  where id = new.category_id;
  if cat_household_id is not null and cat_household_id <> new.household_id then
    raise exception 'category does not belong to this household'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists check_transaction_category_household on public.transactions;
create trigger check_transaction_category_household
  before insert or update of category_id, household_id on public.transactions
  for each row execute function public.check_transaction_category_household();

-- 2. transaction_components.transaction_id skal pege på transaction i
--    samme household (komponentens egen household_id skal matche
--    parent-transactionens household_id)
create or replace function public.check_component_transaction_household()
returns trigger
language plpgsql
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

drop trigger if exists check_component_transaction_household on public.transaction_components;
create trigger check_component_transaction_household
  before insert or update of transaction_id, household_id on public.transaction_components
  for each row execute function public.check_component_transaction_household();
