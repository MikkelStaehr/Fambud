-- ============================================================================
-- 0018 - Loan payment interval + ydelse breakdown
-- ----------------------------------------------------------------------------
-- 0017 added monthly_payment as a single bigint, assuming all loans pay
-- monthly. That doesn't match reality:
--   - Realkredit Danmark / Totalkredit ydelser are typically paid quarterly
--     (kvartalsbetaling) - 4x a year, not 12x.
--   - Banklån are usually monthly but some pay rente quarterly.
--   - Kreditkort have no fixed schedule.
--
-- We also want to break the ydelse into its parts so the user (and a future
-- "lånetjek" feature) can see what's actually moving:
--
--   Ydelse = rente + afdrag + bidrag + rabat
--   (rabat is typically negative - KundeKroner from Totalkredit etc.)
--
-- Changes:
--   1. Rename monthly_payment → payment_amount (no longer always monthly).
--   2. Add payment_interval (recurrence_freq) - defaults to 'monthly' so
--      0017 rows keep their semantics.
--   3. Add payment_start_date - anchor date for the recurrence; used as
--      occurs_on when "Tilføj som månedlig udgift på budget" pushes the
--      loan to a budget account.
--   4. Add payment_rente / payment_afdrag / payment_bidrag / payment_rabat
--      bigint øre, all nullable. Their sum should equal payment_amount;
--      we don't enforce this - the UI computes and shows it as the user
--      types so they catch any input mismatch themselves.
-- ============================================================================

-- 1. Rename monthly_payment → payment_amount
alter table accounts
  rename column monthly_payment to payment_amount;

-- 2. Add payment_interval (defaults to 'monthly' so existing rows behave as
--    they did under 0017)
alter table accounts
  add column if not exists payment_interval recurrence_freq
    not null default 'monthly';

-- 3. Add payment_start_date
alter table accounts
  add column if not exists payment_start_date date;

-- 4. Add breakdown fields
alter table accounts
  add column if not exists payment_rente bigint
    check (payment_rente is null or payment_rente >= 0),
  add column if not exists payment_afdrag bigint
    check (payment_afdrag is null or payment_afdrag >= 0),
  add column if not exists payment_bidrag bigint
    check (payment_bidrag is null or payment_bidrag >= 0),
  -- rabat is typically negative (KundeKroner reduces the ydelse). We allow
  -- both signs so the column also covers a hypothetical positive surcharge
  -- - the UI labels it as "rabat" with a minus-hint.
  add column if not exists payment_rabat bigint;
