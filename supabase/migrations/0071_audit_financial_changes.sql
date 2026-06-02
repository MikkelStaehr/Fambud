-- ============================================================================
-- 0071 - Audit-log for finansielle UPDATE/DELETE via DB-triggers (P16)
-- ----------------------------------------------------------------------------
-- Roadmap-punkt P16 fra SECURITY_AUDITS.md: financial-events #18-#20.
-- Vi tracker UPDATE og DELETE (ikke INSERT - for noisy) på transactions
-- og accounts via PostgreSQL-triggers så hver code-path automatisk er
-- dækket uden at hver action skal huske at kalde logAuditEvent().
--
-- Triggers vælger trigger over app-level wrapping fordi:
--   1. Vi har mange code-paths der UPDATE'er transactions (poster-form,
--      bulk-recategorize, push-loan-to-budget, …). En central trigger
--      garanterer dækning.
--   2. Før-after-snapshots er triviel SQL men kedeligt at gentage i hver
--      action. Trigger laver diff en gang.
--   3. Bypass: hvis nogen kører direkte SQL i Dashboard, fanges det også.
--
-- Action-navne følger eksisterende dot-pattern fra lib/audit-log.ts:
--   transaction.updated / transaction.deleted
--   loan.updated / loan.deleted              (accounts.kind = 'credit')
--   account.updated / account.deleted        (alle andre kinds)
--
-- Metadata-shape: kun ÆNDREDE kolonner i et {before, after}-objekt for
-- UPDATE; fuld snapshot (af tracked-kolonner) for DELETE. Holder log-
-- størrelsen nede og gør diff-aflæsning let.
--
-- Auth-kontekst: auth.uid() bruges som user_id. Den er null når admin-
-- client muterer (proxy-mode + nogle background-paths). Accepteret
-- begrænsning for v1 - kan udvides senere via set_config-pattern.
--
-- CASCADE deletes: når en konto slettes, cascader transactions ned.
-- Trigger fyrer per række. Det er IKKE en bug; det ER det evidens-spor
-- vi vil have (1 account-deleted + N transaction-deleted samme tidspunkt).
--
-- SECURITY DEFINER kræves fordi audit_log har RLS uden policies (DENY
-- ALL for authenticated/anon). Funktioner kører som ejer (postgres),
-- som har BYPASSRLS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Trigger function for transactions
-- ---------------------------------------------------------------------------
create or replace function log_transaction_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_metadata jsonb;
  v_action text;
  v_resource text;
  v_household_id uuid;
begin
  if tg_op = 'UPDATE' then
    -- Diff tracked kolonner. IS DISTINCT FROM håndterer NULL korrekt
    -- (NULL ≠ NULL er false i normal sammenligning).
    if old.amount is distinct from new.amount then
      v_changes := v_changes || jsonb_build_object(
        'amount', jsonb_build_object('before', old.amount, 'after', new.amount)
      );
    end if;
    if old.occurs_on is distinct from new.occurs_on then
      v_changes := v_changes || jsonb_build_object(
        'occurs_on', jsonb_build_object('before', old.occurs_on, 'after', new.occurs_on)
      );
    end if;
    if old.category_id is distinct from new.category_id then
      v_changes := v_changes || jsonb_build_object(
        'category_id', jsonb_build_object('before', old.category_id, 'after', new.category_id)
      );
    end if;
    if old.description is distinct from new.description then
      -- Trunkér til 100 tegn for at undgå log-bloat fra lange beskrivelser.
      v_changes := v_changes || jsonb_build_object(
        'description', jsonb_build_object(
          'before', left(coalesce(old.description, ''), 100),
          'after', left(coalesce(new.description, ''), 100)
        )
      );
    end if;
    if old.recurrence is distinct from new.recurrence then
      v_changes := v_changes || jsonb_build_object(
        'recurrence', jsonb_build_object('before', old.recurrence, 'after', new.recurrence)
      );
    end if;
    if old.account_id is distinct from new.account_id then
      v_changes := v_changes || jsonb_build_object(
        'account_id', jsonb_build_object('before', old.account_id, 'after', new.account_id)
      );
    end if;

    -- Hvis ingen tracked-kolonner ændrede sig (kun updated_at eller andet
    -- intern field), springer vi log'gen over. Holder støjen nede.
    if v_changes = '{}'::jsonb then
      return new;
    end if;

    v_action := 'transaction.updated';
    v_resource := 'transaction:' || new.id::text;
    v_household_id := new.household_id;
    v_metadata := jsonb_build_object('changes', v_changes);

  elsif tg_op = 'DELETE' then
    v_action := 'transaction.deleted';
    v_resource := 'transaction:' || old.id::text;
    v_household_id := old.household_id;
    v_metadata := jsonb_build_object(
      'snapshot', jsonb_build_object(
        'amount', old.amount,
        'occurs_on', old.occurs_on,
        'category_id', old.category_id,
        'description', left(coalesce(old.description, ''), 100),
        'recurrence', old.recurrence,
        'account_id', old.account_id
      )
    );
  end if;

  insert into audit_log (action, resource, result, user_id, household_id, metadata)
  values (v_action, v_resource, 'success', auth.uid(), v_household_id, v_metadata);

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

comment on function log_transaction_change is
  'Trigger function: skriver UPDATE/DELETE på transactions til audit_log med før-after-diff. Springes hvis kun ikke-tracked kolonner ændres. SECURITY DEFINER bypasser RLS på audit_log.';

-- ---------------------------------------------------------------------------
-- Trigger function for accounts (incl. lån, hvor kind = 'credit')
-- ---------------------------------------------------------------------------
create or replace function log_account_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_metadata jsonb;
  v_action_prefix text;
  v_action text;
  v_resource_prefix text;
  v_resource text;
  v_household_id uuid;
  v_kind text;
begin
  v_kind := (case when tg_op = 'DELETE' then old.kind else new.kind end)::text;

  -- Lån (kind = 'credit') får eget action-prefix så rente-ændringer ikke
  -- roder med checking-konto-renames i samme bucket.
  if v_kind = 'credit' then
    v_action_prefix := 'loan';
    v_resource_prefix := 'loan';
  else
    v_action_prefix := 'account';
    v_resource_prefix := 'account';
  end if;

  if tg_op = 'UPDATE' then
    if old.name is distinct from new.name then
      v_changes := v_changes || jsonb_build_object(
        'name', jsonb_build_object('before', old.name, 'after', new.name)
      );
    end if;
    if old.opening_balance is distinct from new.opening_balance then
      v_changes := v_changes || jsonb_build_object(
        'opening_balance', jsonb_build_object('before', old.opening_balance, 'after', new.opening_balance)
      );
    end if;
    if old.payment_amount is distinct from new.payment_amount then
      v_changes := v_changes || jsonb_build_object(
        'payment_amount', jsonb_build_object('before', old.payment_amount, 'after', new.payment_amount)
      );
    end if;
    if old.interest_rate is distinct from new.interest_rate then
      v_changes := v_changes || jsonb_build_object(
        'interest_rate', jsonb_build_object('before', old.interest_rate, 'after', new.interest_rate)
      );
    end if;
    if old.apr is distinct from new.apr then
      v_changes := v_changes || jsonb_build_object(
        'apr', jsonb_build_object('before', old.apr, 'after', new.apr)
      );
    end if;
    if old.payment_afdrag is distinct from new.payment_afdrag then
      v_changes := v_changes || jsonb_build_object(
        'payment_afdrag', jsonb_build_object('before', old.payment_afdrag, 'after', new.payment_afdrag)
      );
    end if;
    if old.balance_as_of_date is distinct from new.balance_as_of_date then
      v_changes := v_changes || jsonb_build_object(
        'balance_as_of_date', jsonb_build_object('before', old.balance_as_of_date, 'after', new.balance_as_of_date)
      );
    end if;
    if old.archived is distinct from new.archived then
      v_changes := v_changes || jsonb_build_object(
        'archived', jsonb_build_object('before', old.archived, 'after', new.archived)
      );
    end if;

    if v_changes = '{}'::jsonb then
      return new;
    end if;

    v_action := v_action_prefix || '.updated';
    v_resource := v_resource_prefix || ':' || new.id::text;
    v_household_id := new.household_id;
    v_metadata := jsonb_build_object('kind', v_kind, 'changes', v_changes);

  elsif tg_op = 'DELETE' then
    v_action := v_action_prefix || '.deleted';
    v_resource := v_resource_prefix || ':' || old.id::text;
    v_household_id := old.household_id;
    v_metadata := jsonb_build_object(
      'kind', v_kind,
      'snapshot', jsonb_build_object(
        'name', old.name,
        'opening_balance', old.opening_balance,
        'payment_amount', old.payment_amount,
        'interest_rate', old.interest_rate,
        'apr', old.apr,
        'payment_afdrag', old.payment_afdrag,
        'balance_as_of_date', old.balance_as_of_date,
        'archived', old.archived
      )
    );
  end if;

  insert into audit_log (action, resource, result, user_id, household_id, metadata)
  values (v_action, v_resource, 'success', auth.uid(), v_household_id, v_metadata);

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

comment on function log_account_change is
  'Trigger function: skriver UPDATE/DELETE på accounts til audit_log. Forgrener på kind=''credit'' → loan.* vs. account.*. SECURITY DEFINER bypasser RLS på audit_log.';

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists transactions_audit_trg on transactions;
create trigger transactions_audit_trg
  after update or delete on transactions
  for each row execute function log_transaction_change();

drop trigger if exists accounts_audit_trg on accounts;
create trigger accounts_audit_trg
  after update or delete on accounts
  for each row execute function log_account_change();

comment on trigger transactions_audit_trg on transactions is
  'P16: auto-logging af UPDATE/DELETE på transactions til audit_log. Se 0071.';
comment on trigger accounts_audit_trg on accounts is
  'P16: auto-logging af UPDATE/DELETE på accounts (inkl. lån) til audit_log. Se 0071.';
