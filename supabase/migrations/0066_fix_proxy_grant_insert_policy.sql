-- Fix: RLS-policy på setup_proxy_grants tillod kun grantor at INSERTE,
-- men i flowet er det grantee (anmoderen) der opretter den pending
-- grant. Når grantor klikker accept-link sætter de bare accepted_at.
--
-- Symptom: "Kunne ikke oprette anmodningen" når Mikkel forsøger at
-- anmode om proxy-adgang til Louise. RLS-policy "grantor creates"
-- (auth.uid() = grantor_user_id) blokerede inserten fordi Mikkels
-- auth.uid() ≠ Louises grantor_user_id.

drop policy if exists "grantor creates" on public.setup_proxy_grants;

create policy "grantee creates request"
  on public.setup_proxy_grants
  for insert
  with check (auth.uid() = grantee_user_id);
