-- Migration 0035: economy_type på households.
--
-- Driver wizard-forgreningen mellem to familie-modeller:
--   'separate' (default): hver voksen har egen lønkonto, sender til Fælles
--                         for delte regninger. Mest almindelige model.
--   'shared'             : begge lønninger lander på én Fælles Lønkonto.
--                          Indkomst registreres stadig pr. person (samme
--                          paycheck-forecast-mekanik) — det er bare kontoen
--                          der er pooled.
--
-- Solo-husstande behøver ikke flag'et — der er kun ét valg. For dem holder
-- vi 'separate' som default. Wizarden viser kun valget for familier.
--
-- Skift mellem typer er ikke understøttet UI-mæssigt: hvis brugeren senere
-- vil ændre, skal de starte forfra. Kolonnen er teknisk mutable, men
-- code-paths antager den er sat én gang ved opsætning.

create type household_economy_type as enum ('separate', 'shared');

alter table public.households
  add column if not exists economy_type household_economy_type
    not null default 'separate';

comment on column public.households.economy_type is
  'Familie-økonomi-model: separate (hver sin lønkonto) eller shared (pooled på Fælles Lønkonto)';
