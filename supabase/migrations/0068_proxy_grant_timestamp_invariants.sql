-- ============================================================================
-- 0068 - Setup proxy grant timestamp-invarianter
-- ----------------------------------------------------------------------------
-- Strammer DB-niveau invarianter på setup_proxy_grants så vi fanger
-- impossible-timestamp-bugs (fx future-bug der opdaterer expires_at til
-- en past timestamp ved et uheld). Sml. v2.1's app-layer Semgrep-regler -
-- DB-constraints er den ultimative defense-in-depth fordi de ikke kan
-- omgås app-side.
--
-- Effekt på eksisterende grants: ingen. Constraint'erne er additive og
-- alle eksisterende rækker (efter migration 0065-0067) overholder dem
-- allerede (expires_at defaulter til now() + interval '7 days' > created_at).
-- ============================================================================

-- 1. Expires_at SKAL være efter created_at. En grant der udløber før den
-- oprettes er nonsens og kan ske ved future-bug i UI/server-action der
-- regner en past timestamp som default.
alter table public.setup_proxy_grants
  add constraint setup_proxy_grants_expires_after_created
  check (expires_at > created_at);

-- 2. Hvis accepted_at er sat, må den ikke være FØR grant blev oprettet.
-- Beskytter mod clock-skew eller manuel mistypning.
alter table public.setup_proxy_grants
  add constraint setup_proxy_grants_accepted_after_created
  check (accepted_at is null or accepted_at >= created_at);

-- 3. Samme for revoked_at.
alter table public.setup_proxy_grants
  add constraint setup_proxy_grants_revoked_after_created
  check (revoked_at is null or revoked_at >= created_at);

-- 4. Scope må ikke være tom array. Default er '{setup}' og det skal
-- forblive ikke-tomt - en grant uden scope giver ikke nogen permissions
-- og er bug-prone (helper-funktioner antager mindst ét element).
alter table public.setup_proxy_grants
  add constraint setup_proxy_grants_scope_non_empty
  check (array_length(scope, 1) > 0);

-- 5. Revoked_by_user_id skal være enten grantor eller grantee. App-laget
-- enforcer det allerede men constraint fanger fremtidige bugs hvor en
-- admin-action ved et uheld revoker uden user-context.
alter table public.setup_proxy_grants
  add constraint setup_proxy_grants_revoker_is_party
  check (
    revoked_by_user_id is null
    or revoked_by_user_id in (grantor_user_id, grantee_user_id)
  );

comment on constraint setup_proxy_grants_expires_after_created on public.setup_proxy_grants
  is 'Defense-in-depth: app-laget kontrollerer dette ved create men constraint fanger framtidige UI/action-bugs der opdaterer expires_at til past.';
