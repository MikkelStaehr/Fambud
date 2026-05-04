-- ============================================================================
-- 0028 - predictable_estimates: kategori-baseret budget for "forudsigelige
-- uforudsete" udgifter
-- ----------------------------------------------------------------------------
-- 15%-af-nettoindkomst-tommelfingerreglen er for grov og giver et alt for
-- højt månedligt tal for de fleste familier. I stedet vil vi have brugeren
-- til at tænke konkret igennem hvad puljen skal dække:
--
--   Gaver - hvor mange personer × hvor meget × hvor mange gange/år
--   Tandlæge - antal personer × pris pr. besøg × besøg/år
--   Bil - afhænger af type (el ~4.000, benzin/diesel ~8.000)
--   Cykel - typisk 500-1.500 kr/år for almindelig vedligehold
--   Andet - fri kategori for det specifikke (briller, kæledyr, ...)
--
-- Hver række gemmes som "label + årligt beløb". Sum / 12 = anbefalet månedlig
-- overførsel til bufferkontoen "Forudsigelige uforudsete".
--
-- Vi gemmer som en separat tabel (ikke som transactions) fordi det er
-- BUDGETPLANLÆGNING, ikke faktiske bogførte udgifter. Tandlægebesøget falder
-- ikke nødvendigvis på en bestemt dato - det er et estimat for året.
-- ============================================================================

create table if not exists predictable_estimates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  label text not null,
  yearly_amount bigint not null check (yearly_amount >= 0),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists predictable_estimates_household_idx
  on predictable_estimates(household_id);

alter table predictable_estimates enable row level security;

-- Husstands-medlemmer kan læse, oprette, opdatere og slette estimater.
-- Samme pattern som family_members og household_invites.
create policy "members manage predictable_estimates"
  on predictable_estimates for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
