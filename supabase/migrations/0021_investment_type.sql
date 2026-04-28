-- ============================================================================
-- 0021 — investment_type subtype on accounts
-- ----------------------------------------------------------------------------
-- En 'investment'-konto kan være mange ting i praksis: aldersopsparing
-- (loft 9.900 kr/år), aktiesparekonto/ASK (loft 135.900 kr i alt),
-- alm. aktiedepot, børneopsparing (loft 6.000 kr/år) eller bredere
-- pensionsordninger (ratepension/livrente). De har vidt forskellige skat- og
-- loftregler, og /konti-grupperingen "Opsparing & investering" siger ikke
-- noget om hvilken slags depot der er tale om.
--
-- Vi tilføjer en valgfri 'investment_type' subtype-kolonne så brugeren kan
-- mærke kontoen op (eller lade den stå tom). UI'et viser type'en som et
-- badge og — for typer med fast loft — en lille loft-info ved siden af
-- saldoen.
--
-- Kolonnen er kun meningsfuld når kind='investment'. Vi håndhæver det IKKE
-- i DB (mindre RLS-/CHECK-støj), men UI'et viser kun feltet når kind matcher.
--
-- Idempotent: skab type if not exists, kolonne if not exists.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'investment_type') then
    create type investment_type as enum (
      'aldersopsparing',
      'aktiesparekonto',
      'aktiedepot',
      'pension',
      'boerneopsparing'
    );
  end if;
end $$;

alter table accounts
  add column if not exists investment_type investment_type;
