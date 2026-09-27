-- ============================================================================
-- 0072 - Famtask: tjekliste før en spark kan blive til et projekt
-- ----------------------------------------------------------------------------
-- En spark må først gøres til projekt når fire ting er på plads:
--   1. Formål           (sparks.note, findes allerede)
--   2. Beløb og måned   (sparks.estimated_amount + sparks.target_month)
--   3. Ansvarlig        (sparks.owner_member_id -> family_members)
--   4. Alle har sagt ja (plan.spark_approvals, én række pr. medlem med login)
--
-- Selve tjekket sker i promoteSpark (app-laget). Det er en procesregel for
-- husstanden, ikke en sikkerhedsgrænse: medlemmer kan i forvejen skrive
-- direkte i deres egne projekter.
--
-- Beløb, måned og ansvarlig følger med over på projektet, så de ikke
-- forsvinder ved forfremmelsen. Derfor får projects de samme to nye felter
-- (target_month havde projects allerede).
--
-- Rører én public-tabel: family_members får unique (id, household_id), så
-- owner_member_id kan få en sammensat FK som i 0070. Unik i forvejen via
-- primærnøglen, så constrainten kan ikke fejle på eksisterende data.
--
-- Nummer 0071 er reserveret til prod-baseline (branch chore/migration-baseline).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Mål for sammensatte FK'er
-- ----------------------------------------------------------------------------
alter table public.family_members
  add constraint family_members_id_household_key unique (id, household_id);

alter table plan.sparks
  add constraint sparks_id_household_key unique (id, household_id);

-- ----------------------------------------------------------------------------
-- 2. Nye felter på sparks og projects
-- ----------------------------------------------------------------------------
-- Beløb som bigint-øre (CLAUDE.md §7). 0 er tilladt: nogle projekter koster
-- ingenting. Måned som første dag i måneden, samme check som i 0070.
-- on delete set null (owner_member_id): slettes medlemmet, mister sparken
-- eller projektet kun sin ansvarlige, household_id bevares.
alter table plan.sparks
  add column estimated_amount bigint
    check (estimated_amount is null or estimated_amount >= 0),
  add column target_month date
    check (target_month is null or target_month = date_trunc('month', target_month)::date),
  add column owner_member_id uuid,
  add constraint sparks_owner_same_household_fkey
    foreign key (owner_member_id, household_id)
    references public.family_members(id, household_id)
    on delete set null (owner_member_id);

alter table plan.projects
  add column estimated_amount bigint
    check (estimated_amount is null or estimated_amount >= 0),
  add column owner_member_id uuid,
  add constraint projects_owner_same_household_fkey
    foreign key (owner_member_id, household_id)
    references public.family_members(id, household_id)
    on delete set null (owner_member_id);

create index sparks_owner_member_idx on plan.sparks(owner_member_id)
  where owner_member_id is not null;
create index projects_owner_member_idx on plan.projects(owner_member_id)
  where owner_member_id is not null;

-- ----------------------------------------------------------------------------
-- 3. plan.spark_approvals
-- ----------------------------------------------------------------------------
-- user_id har default auth.uid(), så appen aldrig sender feltet (CLAUDE.md
-- §2). Primærnøglen gør et dobbeltklik på "Godkend" til en 23505 i stedet
-- for en dublet. Slettes sparken eller brugeren, forsvinder godkendelsen.
create table plan.spark_approvals (
  spark_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (spark_id, user_id),

  constraint spark_approvals_spark_same_household_fkey
    foreign key (spark_id, household_id)
    references plan.sparks(id, household_id)
    on delete cascade
);

create index spark_approvals_household_idx on plan.spark_approvals(household_id);

-- RLS: alle i husstanden kan se godkendelserne, men man kan kun godkende
-- på egne vegne. Sletning er tilladt for alle i husstanden: når sparken
-- ændres, nulstiller appen ALLE godkendelser (også partnerens), og at
-- fjerne en godkendelse gør kun tjeklisten strengere.
alter table plan.spark_approvals enable row level security;

create policy "members read spark approvals"
  on plan.spark_approvals for select
  using (public.is_household_member(household_id));

create policy "members approve as themselves"
  on plan.spark_approvals for insert
  with check (public.is_household_member(household_id) and user_id = auth.uid());

create policy "members remove spark approvals"
  on plan.spark_approvals for delete
  using (public.is_household_member(household_id));

-- Ingen update: en godkendelse gives eller fjernes, den ændres ikke.
grant select, insert, delete on plan.spark_approvals to authenticated, service_role;

notify pgrst, 'reload schema';

comment on table plan.spark_approvals is 'Hvem i husstanden har sagt ja til en spark. Nulstilles af appen når sparken ændres.';
comment on column plan.sparks.owner_member_id is 'Ansvarlig for sparken/projektet. Sammensat FK sikrer samme husstand.';
comment on column plan.projects.owner_member_id is 'Ansvarlig for projektet (arvet fra sparken). Sammensat FK sikrer samme husstand.';
