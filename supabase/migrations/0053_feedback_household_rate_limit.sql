-- Tilføj separat 'feedback_household' rate-limit-route. Vi vil have
-- forskellige loft for per-user (10/time) og per-household (30/time)
-- så et husstand med 5 medlemmer ikke samlet kan sende 50 mails/time
-- og drainere Resend free-tier (3000/md = ~100/dag).

insert into public.rate_limit_routes (route, max_hits, window_seconds)
values ('feedback_household', 30, 3600)
on conflict (route) do update
  set max_hits = excluded.max_hits, window_seconds = excluded.window_seconds;
