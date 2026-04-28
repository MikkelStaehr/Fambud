-- ============================================================================
-- 0020 — add 'investment' to account_kind enum
-- ----------------------------------------------------------------------------
-- Aktiedepot, pensionsdepot, ASK osv. behandles i dag som 'savings', men de
-- er konceptuelt forskellige — de har volatil saldo (markedsværdi), forskelle
-- i skattebehandling og vises typisk separat fra alm. opsparing.
--
-- Tilføj 'investment' som ny enum-værdi så /konti kan gruppere dem under
-- "Opsparing & investering" og fremtidige integrationer (kursdata,
-- afkast-tracking) har et eksplicit anker at hænge sig på.
--
-- Idempotent: 'add value if not exists'.
-- ============================================================================

alter type account_kind add value if not exists 'investment' after 'savings';
