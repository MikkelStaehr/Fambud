-- ============================================================================
-- 0004 - Add 'budget' to account_kind enum
-- ----------------------------------------------------------------------------
-- A budgetkonto (the Danish concept) holds money earmarked for fixed recurring
-- expenses - rent, utilities, insurance, loan payments. It's distinct from a
-- regular checking ("lønkonto") because nothing is spent from it ad-hoc; it's
-- a parking lot for next month's bills. Modelling it as its own enum value
-- lets the UI default sensibly when creating shared accounts in the wizard.
--
-- ALTER TYPE ... ADD VALUE must be run on its own - it cannot share a
-- transaction with statements that subsequently USE the new value. If you run
-- this file in pieces, this statement first is fine.
-- ============================================================================

alter type account_kind add value if not exists 'budget' after 'checking';
