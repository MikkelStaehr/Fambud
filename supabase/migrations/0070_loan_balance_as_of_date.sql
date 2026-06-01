-- ============================================================================
-- 0070 - Auto-amortisering: track hvornår opening_balance sidst blev sat
-- ----------------------------------------------------------------------------
-- Restgælden på et lån har hidtil været en statisk DB-værdi - brugeren skulle
-- selv opdatere den. Med payment_afdrag og payment_interval allerede sat på
-- de fleste lån, kan vi i stedet beregne den løbende: opening_balance var
-- snapshot pr. balance_as_of_date, og siden da er der gået N betalings-
-- perioder à payment_afdrag der trækkes fra.
--
-- Nye lån sætter balance_as_of_date = current_date i create-action'en.
-- Eksisterende lån backfilles til current_date - vi har ingen historisk
-- "hvornår blev balancen sidst sat"-information, så vi nulstiller anker'en
-- til i dag og lader auto-decrement starte klokken nu i stedet for at
-- regne forkert tilbage i tiden.
-- ============================================================================

alter table accounts
  add column balance_as_of_date date;

-- Backfill alle eksisterende credit-konti til i dag. Tom for andre konto-
-- typer (kun lån har en restgæld-snapshot der giver mening at amortisere).
update accounts
  set balance_as_of_date = current_date
  where kind = 'credit'
    and balance_as_of_date is null;

comment on column accounts.balance_as_of_date is 'Dato hvor opening_balance sidst blev sat (manuelt indtastet eller fra bank-opgørelse). Bruges på /laan til at beregne current restgæld via payment_afdrag * perioder_siden_anker. Null for ikke-lån.';
