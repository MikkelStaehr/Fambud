-- ============================================================================
-- 0005 — 'household' account kind + credit-account metadata
-- ----------------------------------------------------------------------------
-- Two changes:
--   1. New enum value 'household' for "husholdningskonto" — the daily-spend
--      account, distinct from a budgetkonto (which holds money earmarked for
--      fixed recurring bills). Most households have both: budget pays rent
--      and utilities; household pays groceries and ad-hoc.
--   2. accounts gain interest_rate and apr columns. Both are nullable and
--      only meaningful for kind='credit'. Stored as float4 (real) — precision
--      below 2 decimals isn't a concern for percentage rates, and real comes
--      back as number from supabase-js (numeric returns as string).
-- ============================================================================

-- Add the enum value first. ALTER TYPE ... ADD VALUE works inside the same
-- transaction as the column adds in PG12+ as long as the new value isn't
-- referenced before commit; we don't reference it here, just add it.
alter type account_kind add value if not exists 'household' after 'budget';

alter table accounts
  add column interest_rate real,  -- Rente (nominal interest), e.g. 5.5 for 5.5%
  add column apr real;            -- ÅOP (annual cost percentage), e.g. 8.75
