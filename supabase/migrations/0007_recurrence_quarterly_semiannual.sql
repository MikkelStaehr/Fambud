-- ============================================================================
-- 0007 - quarterly + semiannual recurrence
-- ----------------------------------------------------------------------------
-- The budget wizard mental model is "månedlig / kvartalvis / halvårligt /
-- årligt", which the original enum doesn't cover. Added between 'monthly'
-- and 'yearly' so the values are ordered by frequency-cadence (handy if we
-- ever sort or compare).
--
-- Same constraint as ALTER TYPE migrations always: don't reference the new
-- values in the same statement that adds them. We just add and stop.
-- ============================================================================

alter type recurrence_freq add value if not exists 'quarterly' after 'monthly';
alter type recurrence_freq add value if not exists 'semiannual' after 'quarterly';
