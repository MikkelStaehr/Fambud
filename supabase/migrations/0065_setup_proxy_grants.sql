-- ============================================================================
-- 0065 - Setup proxy grants: delegeret opsætnings-adgang mellem partnere
-- ----------------------------------------------------------------------------
-- En "proxy grant" er en tidsbegrænset add-only-tilladelse mellem to brugere
-- i samme husstand. Use case: Mikkel kan hjælpe Louise med at sætte hendes
-- økonomi op (lønkonto, paychecks, faste udgifter, opsparing) uden at Louise
-- selv skal sidde foran skærmen.
--
-- Sikkerheds-/privatlivs-model:
-- - ADD-ONLY: proxy-bruger kan kun INSERTE nye rækker, ikke se eksisterende
--   privat data eller redigere/slette. Det forhindrer at proxy bliver
--   ryg-dør til partner's private historik.
-- - Tidsbegrænset: default 7 dages auto-expiry. Begge parter kan revoke
--   manuelt når som helst.
-- - Email-bekræftet samtykke: grantee modtager en HMAC-signed link og skal
--   eksplicit klikke "Ja, giv adgang" før grant aktiveres.
-- - Scope-begrænset: kun bestemte ressource-typer (vi har kun 'setup' i v1
--   som inkluderer accounts, incomes, expenses, transfers, savings).
-- ============================================================================

create table public.setup_proxy_grants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,

  -- Den der GIVER adgang (Louise i vores eksempel)
  grantor_user_id uuid not null references auth.users(id) on delete cascade,
  -- Den der MODTAGER adgang (Mikkel)
  grantee_user_id uuid not null references auth.users(id) on delete cascade,

  -- Scope-tokens. v1 har kun 'setup' der inkluderer alle ressourcer der
  -- typisk er nødvendige for at opsætte en bruger. Fremtidig granularitet
  -- kan tilføje 'accounts', 'incomes' osv. separat.
  scope text[] not null default '{setup}',

  -- HMAC-signed token sendes i email til grantor; vi gemmer kun hash'en
  -- (sha256). Plain-text token vises aldrig i UI eller logs.
  request_token_hash text not null,

  -- Lifecycle-timestamps
  created_at timestamptz not null default now(),
  -- Hvornår selve grant'en udløber (også hvis accepteret). Default 7 dage.
  expires_at timestamptz not null default (now() + interval '7 days'),
  -- Hvornår grantor klikkede "Ja". NULL = ikke accepteret endnu.
  accepted_at timestamptz,
  -- Soft-revoke. Begge parter kan revoke. NULL = aktiv.
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id),

  -- Grantor og grantee skal være forskellige brugere
  constraint different_users check (grantor_user_id <> grantee_user_id)
);

-- Hyppige opslag: "har jeg aktive proxies fra Louise til mig?" og
-- "har Louise aktive grants til andre?"
create index setup_proxy_grants_grantee_active_idx
  on public.setup_proxy_grants (grantee_user_id, expires_at)
  where accepted_at is not null and revoked_at is null;

create index setup_proxy_grants_grantor_idx
  on public.setup_proxy_grants (grantor_user_id, created_at desc);

-- Token hash lookup ved accept-link
create unique index setup_proxy_grants_token_hash_idx
  on public.setup_proxy_grants (request_token_hash);

-- RLS - kun grantor og grantee kan se grant. Husstandsmedlemmer der ikke
-- er en af parterne kan IKKE se (privacy: andre i husstanden behøver ikke
-- vide at Mikkel hjalp Louise).
alter table public.setup_proxy_grants enable row level security;

create policy "grantor or grantee read"
  on public.setup_proxy_grants
  for select
  using (auth.uid() in (grantor_user_id, grantee_user_id));

-- Kun grantor kan oprette grant (anmodning fra grantor's side)
create policy "grantor creates"
  on public.setup_proxy_grants
  for insert
  with check (auth.uid() = grantor_user_id);

-- Begge parter kan revoke (og kun de specifikke felter, men det
-- enforces app-side - RLS kan ikke begrænse columns alene). Kun den
-- grantor der modtager link kan accepte (deres user_id).
create policy "grantor or grantee update"
  on public.setup_proxy_grants
  for update
  using (auth.uid() in (grantor_user_id, grantee_user_id))
  with check (auth.uid() in (grantor_user_id, grantee_user_id));

-- ============================================================================
-- Helper-funktion: er en proxy-grant aktiv mellem to brugere?
-- Bruges af RLS-policies på andre tabeller for at tillade write-as-grantor
-- under aktive proxy-sessioner.
-- ============================================================================
create or replace function public.has_active_proxy(
  p_grantor_user_id uuid,
  p_grantee_user_id uuid,
  p_scope text default 'setup'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.setup_proxy_grants
    where grantor_user_id = p_grantor_user_id
      and grantee_user_id = p_grantee_user_id
      and accepted_at is not null
      and revoked_at is null
      and expires_at > now()
      and p_scope = any(scope)
  );
$$;

-- Funktionen kaldes fra app-laget (ikke direkte fra anon). Revoke broad
-- access.
revoke execute on function public.has_active_proxy(uuid, uuid, text) from public;
grant execute on function public.has_active_proxy(uuid, uuid, text) to authenticated, anon;
