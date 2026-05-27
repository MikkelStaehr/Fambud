-- ============================================================================
-- 0064 - Betalings-påmindelser: ugentlig email om kommende betalinger
-- ----------------------------------------------------------------------------
-- En ugentlig digest til hvert family_member med de betalinger (faste
-- udgifter + overførsler ud) der forfalder i den kommende uge på deres egne
-- konti + husstandens fælleskonti. Hjælper folk huske regninger når de IKKE
-- er inde i appen.
--
-- Default OFF: en ugentlig mail er mere påtrængende end den månedlige
-- oversigt, så det er bevidst opt-in. Brugeren slår den til under
-- /indstillinger.
--
-- Idempotency: last_payment_reminder_sent_at. Cron'en kører ugentligt og
-- springer en bruger over hvis der allerede er sendt inden for de sidste 6
-- dage, så retries / dobbelt-trigger ikke giver dobbelt-mail.
-- ============================================================================

alter table family_members
  add column if not exists payment_reminder_email_enabled boolean not null default false,
  add column if not exists last_payment_reminder_sent_at timestamptz;

-- Partial-index så cron-queriet "find members der har slået påmindelser til"
-- ikke scanner hele tabellen (langt de fleste rækker har det slået fra).
create index if not exists family_members_payment_reminder_eligible_idx
  on family_members(last_payment_reminder_sent_at)
  where payment_reminder_email_enabled = true
    and email is not null
    and user_id is not null;

comment on column family_members.payment_reminder_email_enabled is 'Bruger har slået ugentlige betalings-påmindelser til. Default false (opt-in); slås til under /indstillinger.';
comment on column family_members.last_payment_reminder_sent_at is 'Timestamp for senest sendte betalings-påmindelse. Bruges af cron til at undgå dobbelt-mail ved retries.';
