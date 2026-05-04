-- Migration 0033: adresser på family_members.
--
-- To slags adresser pr. voksent husstandsmedlem:
--   - home_address: bopæl, indtastes ved signup. Bruges til geografisk
--     statistik og evt. kommune-baserede ydelser senere
--   - workplace_address: arbejdsplads. Bruges til:
--       1. Befordringsfradrag-beregning (hjælpe brugeren med deres skat)
--       2. Anonymiseret pendel-statistik (potentielt salgbar i samlet form)
--
-- Begge er valgfri tekstfelter - vi laver ingen geo-coding endnu.
-- Børn (user_id null) får ingen adresser - de bor pr. definition på
-- forældrenes adresse og har ingen arbejdsplads.

alter table public.family_members
  add column if not exists home_address text,
  add column if not exists workplace_address text;

comment on column public.family_members.home_address is
  'Bopælsadresse - indtastes ved signup. Til statistik og kommune-baserede ydelser.';
comment on column public.family_members.workplace_address is
  'Arbejdsplads-adresse - til befordringsfradrag-beregning og pendel-analyse.';
