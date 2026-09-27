-- ============================================================================
-- 0070 - Planlægningsmodul: plan-schema (sparks, projekter, skridt, budget)
-- ----------------------------------------------------------------------------
-- En simpel udgave af Task Studio inde i Fambud:
--   sparks    - løse idéer der fanges hurtigt og evt. forfremmes til projekt
--   projects  - noget husstanden vil gøre, med formål, status og målmåned
--   steps     - konkrete skridt i et projekt, evt. med beløb + måned
--   project_budget (view) - sum af steps.amount pr. projekt
--
-- Eget schema så planlægning holdes adskilt fra Fambuds økonomi-tabeller i
-- public. Ingen public-tabeller røres af denne migration.
--
-- Konventioner fulgt fra resten af Fambud:
--   - household_id på ALLE tabeller, også steps (samme mønster som
--     life_event_items/transaction_components), så RLS er én simpel
--     is_household_member()-policy uden join, og DAL altid kan filtrere
--     .eq('household_id', ...).
--   - Beløb som bigint-øre (CLAUDE.md §7).
--   - Enum-værdier i ASCII (jf. 'foedselsdag' i 0056).
--
-- Afvigelse fra 0045/0047: household-konsistens mellem barn og projekt
-- håndhæves med sammensatte FK'er (project_id, household_id) i stedet for
-- SECURITY DEFINER-triggers. Samme garanti, men deklarativt og uden
-- funktioner der skal revoke'es. Kræver Postgres 15+ (FK med
-- "on delete set null (kolonne)").
--
-- HUSK: tilføj `plan` under Exposed schemas i Supabase API settings, ellers
-- svarer PostgREST 406 (PGRST106) på alle kald mod schemaet.
-- ============================================================================

create schema if not exists plan;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type plan.project_status as enum (
  'ide',      -- tanken er der, intet besluttet
  'aktiv',    -- vi arbejder på det
  'pause',    -- parkeret, men ikke droppet
  'faerdig'   -- gennemført
);

create type plan.step_status as enum (
  'todo',
  'i_gang',
  'faerdig'
);

-- Hvor pengene til et skridt skal komme fra. Bruges senere når et skridt
-- kobles til en planlagt udgift i Fambud (se docs/plan-budget-kobling.md).
create type plan.funding_source as enum (
  'overskud',   -- betales af månedens rådighedsbeløb
  'opsparing',  -- betales af eksisterende opsparing
  'spare_op'    -- skal spares op over tid frem mod month
);

-- ----------------------------------------------------------------------------
-- plan.projects
-- ----------------------------------------------------------------------------
create table plan.projects (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  purpose text,
  status plan.project_status not null default 'ide',
  -- Første dag i målmåneden. NULL = ingen målmåned endnu.
  target_month date check (
    target_month is null or target_month = date_trunc('month', target_month)::date
  ),
  created_at timestamptz not null default now(),

  -- Mål for de sammensatte FK'er fra steps og sparks nedenfor.
  constraint projects_id_household_key unique (id, household_id)
);

create index projects_household_status_idx on plan.projects(household_id, status);

-- ----------------------------------------------------------------------------
-- plan.steps
-- ----------------------------------------------------------------------------
create table plan.steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  position int not null default 0,
  status plan.step_status not null default 'todo',
  amount bigint check (amount is null or amount >= 0),
  -- Første dag i måneden skridtet forventes betalt/udført.
  month date check (
    month is null or month = date_trunc('month', month)::date
  ),
  funding_source plan.funding_source,

  -- Sammensat FK: et skridt kan kun pege på et projekt i SAMME husstand.
  -- Uden den kunne B indsætte et skridt med household_id=B og
  -- project_id=<A's projekt>, fordi FK-tjek ikke går gennem RLS.
  constraint steps_project_same_household_fkey
    foreign key (project_id, household_id)
    references plan.projects(id, household_id)
    on delete cascade
);

create index steps_project_position_idx on plan.steps(project_id, position);
create index steps_household_idx on plan.steps(household_id);
create index steps_household_month_idx on plan.steps(household_id, month)
  where month is not null;

-- ----------------------------------------------------------------------------
-- plan.sparks
-- ----------------------------------------------------------------------------
create table plan.sparks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  note text,
  -- Default auth.uid() så appen ikke skal sende feltet (samme idé som
  -- set_account_created_by i 0003). on delete set null: sparken bliver
  -- i husstanden selvom brugeren slettes.
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  promoted_project_id uuid,

  -- Sammensat FK som på steps. MATCH SIMPLE betyder at tjekket springes
  -- over når promoted_project_id er NULL. Slettes projektet, nulstilles
  -- kun promoted_project_id (household_id bevares).
  constraint sparks_promoted_project_same_household_fkey
    foreign key (promoted_project_id, household_id)
    references plan.projects(id, household_id)
    on delete set null (promoted_project_id)
);

create index sparks_household_created_idx on plan.sparks(household_id, created_at desc);
create index sparks_promoted_project_idx on plan.sparks(promoted_project_id)
  where promoted_project_id is not null;

-- ----------------------------------------------------------------------------
-- plan.project_budget (view)
-- ----------------------------------------------------------------------------
-- security_invoker = true er KRITISK: uden den kører et view med ejerens
-- rettigheder og omgår RLS på projects/steps, dvs. alle ville kunne læse
-- alle husstandes budgetter. Med invoker gælder callerens RLS.
--
-- sum(bigint) giver numeric i Postgres; castes tilbage til bigint-øre.
-- Projekter uden prissatte skridt får total_amount = 0.
create view plan.project_budget
with (security_invoker = true)
as
select
  p.id as project_id,
  p.household_id,
  coalesce(sum(s.amount), 0)::bigint as total_amount
from plan.projects p
left join plan.steps s on s.project_id = p.id
group by p.id, p.household_id;

-- ----------------------------------------------------------------------------
-- RLS - samme household-mønster som life_events (0056)
-- ----------------------------------------------------------------------------
alter table plan.projects enable row level security;
alter table plan.steps enable row level security;
alter table plan.sparks enable row level security;

create policy "members all projects"
  on plan.projects for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members all steps"
  on plan.steps for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members all sparks"
  on plan.sparks for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------
-- Et nyt schema får ikke Supabase's default-grants som public har, så alt
-- gives eksplicit. anon får INTET: planlægning kræver login, og anonyme
-- kald afvises allerede på schema-niveau (før RLS).
--
-- Bevidst ingen "alter default privileges": fremtidige tabeller i plan skal
-- have RLS slået til og grants givet i samme migration, ikke automatisk.
--
-- service_role skal have table-grants for at createAdminClient kan læse
-- (den bypasser RLS, men ikke manglende privileges).
revoke all on schema plan from public;
grant usage on schema plan to authenticated, service_role;

grant select, insert, update, delete on plan.projects, plan.steps, plan.sparks
  to authenticated, service_role;
grant select on plan.project_budget to authenticated, service_role;

-- Genindlæs PostgREST's schema-cache så de nye tabeller er synlige med
-- det samme (når plan er tilføjet under Exposed schemas).
notify pgrst, 'reload schema';

comment on schema plan is 'Planlægningsmodul (sparks, projekter, skridt). Household-scoped via public.is_household_member().';
comment on view plan.project_budget is 'Sum af steps.amount (øre) pr. projekt. security_invoker: respekterer RLS på projects/steps.';
comment on column plan.sparks.promoted_project_id is 'Sat når sparken er forfremmet til et projekt. Sammensat FK sikrer samme husstand.';
