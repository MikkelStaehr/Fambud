-- SECURITY: Postgres grant'er som default EXECUTE til PUBLIC på nye
-- funktioner. For SECURITY DEFINER trigger-funktioner og admin-only
-- helpers er det farligt - en authenticated bruger kunne ellers kalde
-- dem direkte og bypasse normal SQL-flow.
--
-- Vi revoke'r EXECUTE fra anon + authenticated for:
-- - Trigger-only funktioner (kan ikke meningsfuldt kaldes uden NEW/OLD,
--   men EXECUTE-grant er stadig forkert hygiejne)
-- - mark_setup_complete: skal være authenticated-only (ikke anon)
-- - get_household_members: kun authenticated
--
-- Vi lader følgende være EXECUTE-able for anon/authenticated:
-- - is_household_member, can_write_account: bruges af RLS-policies
-- - validate_invite_code: bevidst anon-callable (vi har rate-limit i UI)
-- - rate_limit_check: vores eget rate-limit-helper

-- Trigger-only - INGEN må kalde dem direkte
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_family_members_critical_columns() from public, anon, authenticated;
revoke execute on function public.check_transaction_category_household() from public, anon, authenticated;
revoke execute on function public.check_component_transaction_household() from public, anon, authenticated;
revoke execute on function public.check_transfer_account_household() from public, anon, authenticated;

-- Admin-only - kun authenticated, ikke anon
revoke execute on function public.mark_setup_complete() from public, anon;
-- authenticated beholder execute (kaldes fra wizard/done)

revoke execute on function public.get_household_members(uuid) from public, anon;
-- authenticated beholder execute

-- service_role bypasser alle grants og kan stadig kalde alt.
