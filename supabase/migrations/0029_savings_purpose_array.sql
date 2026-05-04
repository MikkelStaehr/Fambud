-- ============================================================================
-- 0029 - savings_purpose: text → text[] så én konto kan tagges med begge
-- ----------------------------------------------------------------------------
-- 0025 indførte savings_purpose som single text-værdi (buffer ELLER
-- predictable_unexpected). Brugerfeedback: i virkeligheden har de fleste
-- danske familier ÉN "Bufferkonto" der dækker begge formål - nødfond OG
-- forudsigelige uforudsete. Vi tvang dem til at vælge ét.
--
-- Ændring: kolonnen omdøbes til savings_purposes (plural) og bliver et
-- text[]-array. Én konto kan nu være tagget med fx ['buffer',
-- 'predictable_unexpected'] og dukker op i begge anbefalede kort på
-- /opsparinger.
--
-- Migration-strategi: ny kolonne, kopier data, drop gammel. Sikrer at
-- eksisterende rækker bibeholder deres tag uden manuel handling.
-- ============================================================================

-- 1. Ny kolonne med array-type
alter table accounts add column if not exists savings_purposes text[];

-- 2. Backfill fra eksisterende singular kolonne (hvis den stadig findes)
update accounts
   set savings_purposes = ARRAY[savings_purpose]
 where savings_purpose is not null
   and savings_purposes is null;

-- 3. Drop gammel kolonne (med dens check-constraint)
alter table accounts drop column if exists savings_purpose;

-- 4. Check-constraint: alle elementer skal være gyldige purposes.
--    <@ ARRAY[...] = "is contained in" → tjekker at hver værdi i feltets
--    array er en del af den tilladte mængde.
alter table accounts
  add constraint accounts_savings_purposes_check
  check (
    savings_purposes is null
    or savings_purposes <@ ARRAY['buffer', 'predictable_unexpected']
  );

comment on column accounts.savings_purposes is
  'Specialfunktioner for kind=savings-konti. Kan være tom, indeholde et eller begge af buffer/predictable_unexpected. Bruges af /opsparinger til at finde linkede konti for de anbefalede opsparingstyper.';
