-- ============================================================================
-- 0062 - Månedlig oversigts-email: preference + sidste-sendt tracking
-- ----------------------------------------------------------------------------
-- Hver family_member får en kort mail i starten af måneden med
-- forrige måneds indtægter / udgifter / overskud for DERES perspektiv
-- (privat + andel af fælles). Default ON for alle - brugeren kan slå
-- det fra under /indstillinger.
--
-- Idempotency: last_monthly_summary_sent_at tracker hvilken måned der
-- senest blev sendt for. Cron'en springer brugeren over hvis der
-- allerede er sendt for indeværende måneds-cyklus, så et retry eller
-- dobbelt-trigger ikke giver dobbelt-mail.
-- ============================================================================

alter table family_members
  add column if not exists monthly_summary_email_enabled boolean not null default true,
  add column if not exists last_monthly_summary_sent_at timestamptz;

-- Partial-index for at fremskynde cron-queriet "find members der skal
-- have mail og ikke har fået den i denne cyklus". Vi vil kun matche
-- enabled=true OG har email + user_id, så filter på de tre fælder
-- de fleste rækker væk.
create index if not exists family_members_monthly_summary_eligible_idx
  on family_members(last_monthly_summary_sent_at)
  where monthly_summary_email_enabled = true
    and email is not null
    and user_id is not null;

comment on column family_members.monthly_summary_email_enabled is 'Bruger har slået den månedlige oversigts-email til. Default true; kan slås fra under /indstillinger.';
comment on column family_members.last_monthly_summary_sent_at is 'Timestamp for senest sendte månedsoversigt. Bruges af cron til at undgå dobbelt-mail ved retries.';
