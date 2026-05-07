-- ============================================================================
-- 0059 - Begivenheder: link via overførsler i stedet for direkte konto-FK
-- ----------------------------------------------------------------------------
-- Modelskifte: en begivenhed har ikke længere en linked_account_id - i
-- stedet linker en overførsel til en begivenhed via transfers.life_event_id.
--
-- Hvorfor: linked_account_id på event'en konflaterede "intent" (her vil
-- jeg gerne have pengene) med "action" (her sender jeg pengene). Den nye
-- model splitter rent: event = mål, transfer = handling, link = transfer.
-- En event kan have N transfers (multi-contributor: hver person sin
-- overførsel fra sin lønkonto til samme to_account).
--
-- Live status:
--   planning   - ingen aktiv monthly transfer tied til event
--   active     - mindst én monthly transfer tied til event
--   completed  - terminal, manuelt sat
--   cancelled  - terminal, manuelt sat
-- DB-kolonnen status bevarer kun terminale states; planning/active
-- beregnes på read.
--
-- Eksisterende rækker: brugeren har bekræftet at der ikke er reel data
-- (kun deres egen test-event). Vi backfiller IKKE - eksisterende events
-- mister linket og bliver planning indtil brugeren opsætter en
-- overførsel.
-- ============================================================================

-- 1. Drop linked_account_id fra life_events
alter table life_events
  drop column if exists linked_account_id;

-- 2. Tilføj life_event_id på transfers. on delete set null så slet af
--    event ikke vrækker en aktiv overførsel - brugeren kan beslutte at
--    beholde overførslen som "anden opsparing".
alter table transfers
  add column life_event_id uuid references life_events(id) on delete set null;

-- 3. Index på life_event_id for hurtige opslag "har dette event en
--    overførsel?" + "alle transfers tied til X". Partial-index så
--    transfers uden link (langt størstedelen) ikke bloater index'et.
create index transfers_life_event_id_idx
  on transfers(life_event_id)
  where life_event_id is not null;

-- RLS er allerede dækket af eksisterende "members all transfers"-policy
-- (migration 0001) - den tjekker household_id, og life_event_id-feltet
-- påvirker ikke det. Ingen ny policy nødvendig.

comment on column transfers.life_event_id is 'Optional link til en begivenhed (life_events). Sat når overførslen er oprettet som opsparing til et bestemt mål. Bruges til at beregne live status på event og til agentens "underfunded"-detektion.';
