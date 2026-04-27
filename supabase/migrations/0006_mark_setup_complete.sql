-- ============================================================================
-- 0006 — mark_setup_complete() RPC
-- ----------------------------------------------------------------------------
-- The wizard's done step needs to update household_members.setup_completed_at
-- on the caller's row, but household_members only has a SELECT policy from
-- 0001 — UPDATEs are silently blocked by RLS (0 rows affected, no error).
-- That left users bouncing back into /wizard from the (app) layout's gate
-- after clicking "Til dashboard".
--
-- Two ways to fix this:
--   1. Add a broad UPDATE policy on household_members.
--   2. SECURITY DEFINER function that does only this one thing.
--
-- Going with (2) — least privilege. The function can't be abused to change
-- a user's role or move them to another household, only to set their
-- setup_completed_at to now() if it's still NULL.
-- ============================================================================

create or replace function public.mark_setup_complete()
returns void
language sql
security definer
set search_path = public
as $$
  update public.household_members
  set setup_completed_at = now()
  where user_id = auth.uid()
    and setup_completed_at is null;
$$;

grant execute on function public.mark_setup_complete() to authenticated;
