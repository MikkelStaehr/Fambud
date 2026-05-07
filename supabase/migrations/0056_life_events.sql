-- ============================================================================
-- 0056 - Begivenheder (life events): planlagte større opsparingsmål
-- ----------------------------------------------------------------------------
-- En "begivenhed" er en konkret livsbegivenhed brugeren sparer op til:
-- konfirmation, bryllup, rund fødselsdag, større rejse, bolig- eller bilkøb,
-- studieafslutning, eller andet. Adskilt fra `accounts`/`opsparinger` fordi:
--
--   1. Den kan have linje-poster (life_event_items) der summer til total-
--      budgettet - en bryllups-budget består typisk af lokale, mad, foto,
--      tøj osv. brudt ud per linje.
--   2. Den har en deadline-natur (dato eller bucket-tidsramme) som ikke
--      passer på en almindelig opsparingskonto.
--   3. Den kan linke til en savings/investment-konto via linked_account_id
--      så reel kontosaldo viser fremdrift mod målet, men kontoen ejes ikke
--      af begivenheden - flere begivenheder kan dele én "fælles
--      opsparing"-konto, og en begivenhed kan eksistere uden konto endnu.
--
-- Pendant til /laan: dér linker en credit-konto til en gæld; her linker en
-- savings-konto til et mål. Symmetri af håb og frygt.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type life_event_type as enum (
  'konfirmation',
  'bryllup',
  'foedselsdag',
  'rejse',
  'bolig',
  'studie',
  'andet'
);

create type life_event_status as enum (
  'planning',   -- ideen er på plads, ikke aktivt sparet op endnu
  'active',     -- aktiv opsparing er igang
  'completed',  -- begivenheden er sket
  'cancelled'   -- droppet, gemmes for historik (ikke slettes)
);

-- Bucket-tidsramme når brugeren ikke har en konkret dato. Buckets matcher
-- landing-flow'ets oprindelige spørgsmål-set udvidet med 5 og 10 år til
-- længere mål (boligkøb, pensionsnær opsparing).
create type life_event_timeframe as enum (
  'within_1y',
  'within_2y',
  'within_5y',
  'within_10y'
);

-- Item-status: hvor langt brugeren er i indkøb/booking. 'planlagt' =
-- estimeret pris, 'booket' = aftalt med leverandør (kontrakt klar),
-- 'betalt' = penge er ude af døren.
create type life_event_item_status as enum (
  'planlagt',
  'booket',
  'betalt'
);

-- ----------------------------------------------------------------------------
-- life_events
-- ----------------------------------------------------------------------------
create table life_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  type life_event_type not null default 'andet',

  -- Budget: total_budget er det frie tal brugeren skriver. Hvis
  -- use_items_for_budget=true, ignoreres total_budget i UI'et og summen af
  -- items.amount bruges som total. Vi gemmer total_budget alligevel så
  -- brugeren kan toggle frem og tilbage uden at miste tal.
  total_budget bigint check (total_budget is null or total_budget >= 0),
  use_items_for_budget boolean not null default false,

  -- Tidshorisont: target_date for konkret dato, timeframe for bucket.
  -- Begge null tillades (brugeren har ikke besluttet endnu). Constraint
  -- nedenfor forhindrer at begge sættes samtidig.
  target_date date,
  timeframe life_event_timeframe,

  -- Optional link til savings/investment-konto. NULL = "ikke besluttet
  -- hvilken konto endnu". Når sat, kan UI vise progress = saldo/total_budget.
  -- on delete set null så slet af konto ikke knuser begivenheden.
  linked_account_id uuid references accounts(id) on delete set null,

  status life_event_status not null default 'planning',
  notes text,

  created_at timestamptz not null default now(),

  -- XOR: enten konkret dato eller bucket, ikke begge. Begge null er OK.
  constraint life_events_date_xor_timeframe check (
    not (target_date is not null and timeframe is not null)
  )
);

create index life_events_household_idx on life_events(household_id);
create index life_events_status_idx on life_events(household_id, status);
create index life_events_target_date_idx on life_events(target_date)
  where target_date is not null;

-- ----------------------------------------------------------------------------
-- life_event_items
-- ----------------------------------------------------------------------------
-- household_id denormaliseres på item-niveau så RLS kan policere uden join.
-- Samme mønster som transaction_components (0010). Holder simple is_household_
-- member-policies fast.
create table life_event_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references life_events(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  amount bigint not null default 0 check (amount >= 0),
  status life_event_item_status not null default 'planlagt',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index life_event_items_event_idx on life_event_items(event_id, sort_order);
create index life_event_items_household_idx on life_event_items(household_id);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table life_events enable row level security;
alter table life_event_items enable row level security;

create policy "members all life_events"
  on life_events for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members all life_event_items"
  on life_event_items for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
