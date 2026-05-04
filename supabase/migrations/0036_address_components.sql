-- Migration 0036: split adresser i strukturerede komponenter.
--
-- Tidligere var home_address og workplace_address ét tekstfelt med hele
-- adressen (gade, etage, postnr, by). Det er fint til lagring men dårligt
-- til at queriere på (fx "alle medlemmer i 1620 København V") og umuligt
-- at validere mod et adresseregister.
--
-- Vi splitter i 3 felter pr. adresse:
--   home_address      = gade + nr + evt. etage/lejlighed (fx "Vesterbrogade 12, 3.tv")
--   home_zip_code     = 4-cifret dansk postnummer (fx "1620")
--   home_city         = by-navn (fx "København V")
--
-- Eksisterende home_address-data forbliver i feltet - brugeren kan rydde
-- og indtaste igen, eller vi kan lave migration der parser det fra string
-- (postnr+by følger næsten altid efter komma). For nu: ingen automatisk
-- migration - formerne tvinger ny indtastning ved første redigering.

alter table public.family_members
  add column if not exists home_zip_code text,
  add column if not exists home_city text,
  add column if not exists workplace_zip_code text,
  add column if not exists workplace_city text;

comment on column public.family_members.home_zip_code is
  '4-cifret dansk postnummer for bopælsadressen';
comment on column public.family_members.home_city is
  'By-navn for bopælsadressen (matchende postnr)';
comment on column public.family_members.workplace_zip_code is
  '4-cifret dansk postnummer for arbejdsplads-adressen';
comment on column public.family_members.workplace_city is
  'By-navn for arbejdsplads-adressen';
