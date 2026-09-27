-- ============================================================================
-- 0075 - Famtask: mail til den ansvarlige
-- ----------------------------------------------------------------------------
-- Når nogen sætter eller skifter "Ansvarlig" på en spark eller et projekt,
-- får den nye ansvarlige en mail (updateSpark/updateProject). Ingen mail
-- når man gør sig selv ansvarlig, og ingen til medlemmer uden login/email.
--
-- Default ON som den månedlige oversigt (0062); kan slås fra under
-- /indstillinger/profil. Kolonnen er ikke låst af guard-triggeren fra
-- 0046, så medlemmet kan selv ændre den på sin egen række.
--
-- Rate-limit: højst 20 mails i timen pr. afsender, så man ikke kan spamme
-- sin partner ved at skifte ansvarlig frem og tilbage. Rammes loftet,
-- gemmes ændringen stadig; der sendes bare ingen mail.
-- ============================================================================

alter table family_members
  add column if not exists famtask_email_enabled boolean not null default true;

comment on column family_members.famtask_email_enabled is 'Mail når man bliver ansvarlig for en spark eller et projekt i Famtask. Default true; kan slås fra under /indstillinger/profil.';

insert into public.rate_limit_routes (route, max_hits, window_seconds) values
  ('famtask_assignment_email', 20, 3600)
on conflict (route) do update
  set max_hits = excluded.max_hits, window_seconds = excluded.window_seconds;
