-- Audit-log: tilfoej acting_user_id til at understoette setup-proxy.
--
-- Baggrund: setup-proxy (migration 0065) lader en bruger (grantee, fx Mikkel)
-- udfoere add-only opsaetnings-handlinger PAA VEGNE AF et andet familiemedlem
-- (grantor, fx Louise). Den eksisterende audit_log.user_id-kolonne fanger kun
-- EEN aktoer. For delegerede handlinger har vi brug for at adskille:
--
--   user_id        = den RAMTE bruger (ressourcen tilskrives, fx Louise)
--   acting_user_id = den der FAKTISK udfoerte handlingen (fx Mikkel)
--
-- For ikke-proxy-events er acting_user_id null (aktoer = user_id, ingen
-- delegation). Det giver et praecist svar paa "hvem gjorde hvad paa hvis vegne".

alter table audit_log
  add column acting_user_id uuid references auth.users(id) on delete set null;

comment on column audit_log.acting_user_id is
  'Den faktisk handlende bruger ved delegerede handlinger (setup-proxy). Null naar aktoer = user_id (ingen delegation). Se migration 0065.';

-- Index til "hvad har aktoer X gjort (ogsaa paa andres vegne)?" - partial
-- fordi de fleste events ikke er delegerede (acting_user_id is null).
create index audit_log_acting_user_id_idx
  on audit_log (acting_user_id)
  where acting_user_id is not null;
