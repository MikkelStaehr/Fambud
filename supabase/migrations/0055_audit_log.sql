-- Audit log: append-only sikkerheds-event-historik.
--
-- Indeholder login/logout, password-reset, invite-redemption, account-
-- deletion, member-changes osv. Bruges til:
-- 1. Detektion af mistænkelig aktivitet (failed login spike osv.)
-- 2. Bevisførelse ved breach-investigation (Art. 33 GDPR-rapportering)
-- 3. Bruger-rettigheds-audit (kan vise en bruger hvad der er sket på
--    deres konto)
--
-- VIGTIGT: tabellen er kun-INSERT for service-role-klient. Almindelige
-- authenticated-brugere har INGEN read/write-adgang via RLS - audit-log
-- må ikke kunne manipuleres af angriber der har taget en bruger over.

create table audit_log (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),

  -- Hvem (kan være null for fejlede logins hvor user ikke kan slås op)
  user_id uuid references auth.users(id) on delete set null,
  household_id uuid references households(id) on delete set null,

  -- Hvad
  action text not null,
  resource text,           -- fx 'invite_code:ABC12345' eller 'family_member:<uuid>'
  result text not null check (result in ('success', 'failure', 'denied')),

  -- Hvor fra (request-context)
  ip text,
  user_agent text,

  -- Ekstra strukturerede detaljer (PII-strippet via lib/audit-log.ts)
  metadata jsonb not null default '{}'::jsonb
);

-- Indexes til de hyppigste forespørgsler:
-- 1. "Hvad skete der i sidste døgn?" → occurred_at DESC
create index audit_log_occurred_at_idx on audit_log (occurred_at desc);

-- 2. "Hvad har user X gjort?" → user_id partial (mange events har null user)
create index audit_log_user_id_idx on audit_log (user_id) where user_id is not null;

-- 3. "Hvor mange failed logins?" → action partial-match
create index audit_log_action_result_idx on audit_log (action, result);

-- 4. "Mistænkelig IP-aktivitet?" → ip partial (kan være null)
create index audit_log_ip_idx on audit_log (ip) where ip is not null;

-- RLS: ingen policies → DENY ALL for authenticated/anon. Service-role
-- omgår RLS og kan både skrive og læse. Det betyder:
-- - App-koden skal bruge createAdminClient() til at logge events
-- - Admin-personer (Mikkel) ser logs via Supabase Dashboard som
--   service-role
-- - En kompromitteret bruger-konto kan ikke slette sin egen audit trail
alter table audit_log enable row level security;

-- Vi tilføjer ikke noget GRANT for authenticated/anon - selv hvis RLS
-- ved en fejl droppes, har de ingen base-privileges.
revoke all on audit_log from authenticated, anon;

comment on table audit_log is 'Append-only security audit log. Skrives kun via service-role. Authenticated/anon har ingen RLS- eller GRANT-adgang. Retention: minimum 90 dage, anbefalet 365 dage.';
comment on column audit_log.action is 'Dot-separated event-type, fx login.success, password.reset_requested, invite.redeemed, account.deleted.';
comment on column audit_log.metadata is 'Strukturerede detaljer (jsonb). PII-redaction sker i app-laget før insert (lib/audit-log.ts).';

-- Manuel retention-rensing (ingen pg_cron sat op endnu):
-- delete from audit_log where occurred_at < now() - interval '365 days';
