-- Rate-limit-tabel til at bremse abuse på public auth-flows + feedback.
-- Vi laver det selv (frem for Upstash/Redis) så vi ikke har eksterne
-- afhængigheder - en simpel insert + count i Postgres rækker fint til
-- vores skala.
--
-- Brug: en helper i lib/rate-limit.ts logger en hit pr. (key, route),
-- tæller hits inden for et vindue (fx 1 time), og afviser hvis loftet
-- er nået. `key` er typisk IP-adresse eller email-hash, route er
-- 'signup' / 'reset_password' / 'feedback' osv.
--
-- Vi rydder gamle rækker med en cron eller manuel cleanup - en row
-- pr. minut/IP er overkommeligt selv ved hård abuse.

create table public.rate_limits (
  id bigserial primary key,
  key text not null,
  route text not null,
  occurred_at timestamptz not null default now()
);

-- Index for hurtig count-query: WHERE key=? AND route=? AND occurred_at>?
create index rate_limits_lookup_idx
  on public.rate_limits (key, route, occurred_at desc);

-- Vi RLS-disabler tabellen og lader den kun være tilgængelig via
-- service_role-helpers (insert + count fra server-side server actions).
-- Brugerne skal aldrig kunne læse eller skrive den direkte.
alter table public.rate_limits enable row level security;

-- Ingen policies → default deny. service_role bypasser RLS, så vores
-- server-side Supabase-klient (med authenticated brugers JWT) KAN IKKE
-- skrive direkte til denne tabel. Vi bruger derfor en SECURITY DEFINER-
-- funktion til at incrementere hits + tjekke loft.

create or replace function public.rate_limit_check(
  p_key text,
  p_route text,
  p_max_hits int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_hits int;
begin
  -- Tæl hits inden for vinduet
  select count(*) into current_hits
  from public.rate_limits
  where key = p_key
    and route = p_route
    and occurred_at > now() - (p_window_seconds || ' seconds')::interval;

  if current_hits >= p_max_hits then
    return false;
  end if;

  -- Log denne hit
  insert into public.rate_limits (key, route)
  values (p_key, p_route);

  return true;
end;
$$;

-- Lad authenticated + anon kalde funktionen (vi kan ikke begrænse
-- public auth-flows der ikke har en bruger endnu)
grant execute on function public.rate_limit_check(text, text, int, int) to anon, authenticated;

-- Cleanup-funktion til ældre end 24 timer; kør manuelt eller via cron
create or replace function public.rate_limit_cleanup()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.rate_limits where occurred_at < now() - interval '24 hours';
end;
$$;
