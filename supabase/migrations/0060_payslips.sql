-- ============================================================================
-- 0060 - Lønsedler: registrering + linje-poster per familiemember
-- ----------------------------------------------------------------------------
-- En lønseddel er privatøkonomi - knyttet til ÉN family_member, ikke til
-- household som en helhed. To partnere i samme husstand har hver deres
-- egen serie af lønsedler. Listen på /loensedler viser kun den indloggede
-- brugers egne, og dashboard-prompts (PR 7) målrettes per-person.
--
-- Datamodel:
--   payslips         - én række per registrering (måned eller anden periode)
--                       med metadata + saldoer (ferie, overarbejde, afspadsering)
--   payslip_lines    - mange rækker per lønseddel med raw_label + signed
--                       beløb + kategori-enum. Brutto/netto udledes på read
--                       (sum af positive vs sum af alle).
--
-- Klassifikations-taxonomi læres per-bruger via opslag på allerede
-- gemte linjer - ingen separat lookup-tabel. Når brugeren skriver
-- "Holddrift-tillæg" i form'en, slår vi op i payslip_lines hvilken
-- kategori de plejer at give det label, og pre-vælger den.
--
-- Fortegn-konvention:
--   amount > 0   indtægter (grundløn, tillæg, feriepenge, arbejdsgiver-pension)
--   amount < 0   fradrag (AM-bidrag, A-skat, egen-pension, ATP, akasse, fagforening)
-- Brugeren skriver altid positive tal i UI'et; server-action normaliserer
-- fortegnet ud fra kategori. Det er bevidst valgt: lønsedler skriver
-- også positive tal selvom de er fradrag, og det matcher brugerens
-- mentale model.
-- ============================================================================

create type payslip_line_category as enum (
  -- Indtægter (gemmes med amount > 0)
  'grundlon',              -- basisløn / bruttoløn
  'tillaeg',               -- overarbejde, nattillæg, weekendtillæg, holddrift osv.
  'feriepenge_optjent',    -- optjent feriegodtgørelse (12,5% af løn)
  'pension_arbejdsgiver',  -- arbejdsgivers pensionsbidrag

  -- Fradrag (gemmes med amount < 0)
  'pension_egen',          -- egen-betaling pension
  'atp',                   -- Arbejdsmarkedets Tillægspension
  'am_bidrag',             -- arbejdsmarkedsbidrag (8% af bruttoløn)
  'a_skat',                -- A-skat (statslig + kommunal indkomstskat)
  'akasse',                -- A-kasse-kontingent
  'fagforening',           -- fagforeningskontingent
  'fradrag_andet',         -- andre fradrag (kantine, lønforskud, …)

  -- Bruger-defineret (kan være enten + eller -)
  'andet'
);

create table payslips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  family_member_id uuid not null references family_members(id) on delete cascade,

  period_start date not null,                    -- typisk 1. i måneden
  period_end date not null,                      -- typisk sidste dag
  pay_date date,                                 -- udbetalingsdato (optional)
  employer text,                                 -- fri tekst, fx "Acme A/S"

  -- Periode-saldoer EFTER denne lønseddel (state ved periode-end).
  -- bigint i hundrededele for konsistens med beløb-konventionen:
  --   feriesaldo: 18,5 dage = 1850
  --   overarbejde: 12,3 timer = 1230
  -- nullable - mange lønsedler viser ikke disse felter, og benefits-
  -- modtagere (dagpenge, SU) har slet ikke ferie-konceptet.
  feriesaldo_remaining bigint,
  overarbejde_remaining bigint,
  afspadsering_remaining bigint,

  notes text,
  created_at timestamptz not null default now(),

  constraint payslips_period_valid check (period_end >= period_start)
);

create index payslips_household_idx on payslips(household_id);
-- Hovedopslagsvejen: "alle lønsedler for ÉN person, nyeste først".
-- Driver listen på /loensedler og dashboard-prompt-tjekket
-- ("har Mikkel lønseddel for indeværende måned?").
create index payslips_member_period_idx
  on payslips(family_member_id, period_start desc);

create table payslip_lines (
  id uuid primary key default gen_random_uuid(),
  payslip_id uuid not null references payslips(id) on delete cascade,
  -- household_id denormaliseret for RLS uden join (samme mønster som
  -- transaction_components, life_event_items).
  household_id uuid not null references households(id) on delete cascade,

  raw_label text not null check (length(trim(raw_label)) > 0),
  -- Signed øre. UI sender altid positive tal; server-action sætter
  -- fortegn ud fra category før insert.
  amount bigint not null,
  category payslip_line_category not null default 'andet',

  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index payslip_lines_payslip_idx on payslip_lines(payslip_id, sort_order);
create index payslip_lines_household_idx on payslip_lines(household_id);
-- Klassifikations-taxonomi-opslag: "hvilken kategori plejer brugeren
-- at give label X?". Partial index (label_lower) for case-insensitive
-- lookup uden at lagre normaliseret label på selve rækken.
create index payslip_lines_label_lookup_idx
  on payslip_lines(household_id, lower(raw_label));

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table payslips enable row level security;
alter table payslip_lines enable row level security;

-- Hele husstanden kan teknisk læse hinandens lønsedler (samme policy
-- som accounts), men UI'et håndhæver privatøkonomi-konventionen ved at
-- filtrere på family_member_id = den indloggede brugers eget medlem.
-- Det er bevidst: hvis to partnere senere ønsker at dele indsigt,
-- behøver vi ikke RLS-ændring - kun UI-ændring.
create policy "members all payslips"
  on payslips for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members all payslip_lines"
  on payslip_lines for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

comment on table payslips is 'Privatøkonomi-lønsedler per family_member. Brutto/netto udledes på read (sum af positive vs sum af alle payslip_lines).';
comment on column payslips.feriesaldo_remaining is 'Resterende feriedage i hundrededele (18,5 dage = 1850). Nullable - mange lønsedler / benefits-modtagere har ikke feltet.';
comment on column payslip_lines.amount is 'Signed øre. Positive = indtægt, negative = fradrag. UI sender positive; server normaliserer fortegn ud fra category.';
comment on column payslip_lines.raw_label is 'Den tekst brugeren skrev / læste på lønsedlen. Bruges til klassifikations-læring: nye lønsedler med samme label foreslås automatisk i samme kategori.';
