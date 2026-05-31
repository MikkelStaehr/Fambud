// Accounts CRUD + flow-aggregation pr. konto. Domænet dækker både den
// almindelige konto-liste (/konti) og specialiserede views (/budget,
// /opsparinger). Lån (kind='credit') hører til loans.ts og er bevidst
// EKSKLUDERET fra alle helpers her - /laan har sin egen flow.

import type { Account, AccountKind, RecurrenceFreq } from '@/lib/database.types';
import { effectiveAmount, monthlyEquivalent } from '@/lib/format';
import {
  getPerspective,
  privateAccountFilter,
  getVisibleAccountIds,
} from './auth';

export async function getAccounts(
  opts: { includeArchived?: boolean } = {}
): Promise<Account[]> {
  const p = await getPerspective();
  let query = p.supabase.from('accounts').select('*').eq('household_id', p.householdId);
  if (!opts.includeArchived) query = query.eq('archived', false);
  // I proxy-mode bypasser admin-client RLS - vi geninstaller privacy-filteret
  // så Mikkel kun ser de konti Louise selv ville se (delte + hendes private).
  query = query.or(privateAccountFilter(p));
  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getAccountById(id: string): Promise<Account> {
  const p = await getPerspective();
  let query = p.supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .eq('household_id', p.householdId);
  query = query.or(privateAccountFilter(p));
  const { data, error } = await query.single();
  if (error) throw error;
  return data;
}

// Steady-state cashflow per account in monthly øre, opdelt på kilde så
// /konti kan vise "udgifter" og "overført til andre konti" hver for sig
// (de er to vidt forskellige ting: forbrug vs. flytning af egne penge).
//
// Datakilder:
//   1. Recurring transactions (income/expense via kategori-kind)
//   2. Recurring transfers (ind/ud mellem konti)
//   3. Primary-paychecks gemt som recurrence='once' + income_role='primary'.
//      VIGTIGT: vi grupperer pr. (konto, family_member) og tager de 3 seneste
//      for HVER person hver for sig, og summer derefter. Tidligere tog vi
//      gennemsnit af de 3 seneste paychecks på kontoen UANSET hvem de
//      tilhørte - hvis to personer havde lønsedler på samme konto blev "de
//      seneste 3" en meningsløs blanding (bug spottet ved bruger-test:
//      /konti viste 26.233 mens /indkomst-forecast og dashboard viste
//      31.396). Vi viser kontoens FAKTISKE samlede indtægt - hver lønkonto
//      tilhører normalt én person, så det er typisk dén persons løn.
//
// Bruges af /konti til at erstatte den misvisende opening_balance-saldo med
// en flow-orienteret repr i tråd med appens cashflow-filosofi.
export type AccountFlow = {
  income: number;        // kontoens samlede indtægt (recurring income + paychecks pr. person)
  transfersIn: number;   // overført ind fra andre konti
  expense: number;       // faste udgifter PÅ kontoen
  transfersOut: number;  // overført ud til andre konti
};

export async function getAccountFlows(): Promise<Map<string, AccountFlow>> {
  const p = await getPerspective();
  // I proxy-mode bruges admin-client og RLS er ikke aktiv. For child-tabeller
  // (transactions/transfers) skal vi manuelt scope til de konti perspective'en
  // kan se - svarende til RLS's can_write_account()-gating.
  const visibleAccountIds = await getVisibleAccountIds();
  // Tomme proxy-visible-accounts = perspective ser ingenting. Returner tom Map
  // i stedet for at sende ".in.()" som PostgREST ikke kan parse.
  if (visibleAccountIds && visibleAccountIds.length === 0) {
    return new Map();
  }

  const txnsQ = p.supabase
    .from('transactions')
    .select(
      'account_id, amount, recurrence, components_mode, category:categories(kind), components:transaction_components(amount)'
    )
    .eq('household_id', p.householdId)
    .neq('recurrence', 'once');
  const transfersQ = p.supabase
    .from('transfers')
    .select('from_account_id, to_account_id, amount, recurrence')
    .eq('household_id', p.householdId)
    .neq('recurrence', 'once');
  const paychecksQ = p.supabase
    .from('transactions')
    .select('account_id, family_member_id, amount, occurs_on')
    .eq('household_id', p.householdId)
    .eq('income_role', 'primary')
    .eq('recurrence', 'once')
    .order('occurs_on', { ascending: false });

  const [txnsRes, transfersRes, paychecksRes] = await Promise.all([
    (visibleAccountIds
      ? txnsQ.in('account_id', visibleAccountIds)
      : txnsQ
    ).returns<{
      account_id: string;
      amount: number;
      recurrence: RecurrenceFreq;
      components_mode: 'additive' | 'breakdown';
      category: { kind: 'income' | 'expense' } | null;
      components: { amount: number }[];
    }[]>(),
    visibleAccountIds
      ? transfersQ.or(
          `from_account_id.in.(${visibleAccountIds.join(',')}),to_account_id.in.(${visibleAccountIds.join(',')})`
        )
      : transfersQ,
    (visibleAccountIds
      ? paychecksQ.in('account_id', visibleAccountIds)
      : paychecksQ
    ).returns<{
      account_id: string;
      family_member_id: string | null;
      amount: number;
      occurs_on: string;
    }[]>(),
  ]);

  if (txnsRes.error) throw txnsRes.error;
  if (transfersRes.error) throw transfersRes.error;
  if (paychecksRes.error) throw paychecksRes.error;

  const flows = new Map<string, AccountFlow>();
  const flowFor = (id: string): AccountFlow => {
    let cur = flows.get(id);
    if (!cur) {
      cur = { income: 0, transfersIn: 0, expense: 0, transfersOut: 0 };
      flows.set(id, cur);
    }
    return cur;
  };

  for (const t of txnsRes.data ?? []) {
    const eff = effectiveAmount(t.amount, t.components ?? [], t.components_mode);
    const monthly = monthlyEquivalent(eff, t.recurrence);
    if (t.category?.kind === 'income') flowFor(t.account_id).income += monthly;
    else if (t.category?.kind === 'expense') flowFor(t.account_id).expense += monthly;
  }

  for (const tr of transfersRes.data ?? []) {
    const monthly = monthlyEquivalent(tr.amount, tr.recurrence);
    flowFor(tr.from_account_id).transfersOut += monthly;
    flowFor(tr.to_account_id).transfersIn += monthly;
  }

  // Paychecks: gruppér pr. (konto, member), tag de 3 seneste for HVER person,
  // average hver person for sig, og summer derefter ind på kontoen. Det giver
  // kontoens reelle samlede indtægt uden den gamle "blandet-by-date"-bug.
  const paycheckGroups = new Map<string, { accountId: string; amounts: number[] }>();
  for (const p of paychecksRes.data ?? []) {
    const key = `${p.account_id}|${p.family_member_id ?? ''}`;
    let grp = paycheckGroups.get(key);
    if (!grp) {
      grp = { accountId: p.account_id, amounts: [] };
      paycheckGroups.set(key, grp);
    }
    if (grp.amounts.length < 3) grp.amounts.push(p.amount);
  }
  for (const { accountId, amounts } of paycheckGroups.values()) {
    if (amounts.length === 0) continue;
    const avg = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    flowFor(accountId).income += Math.round(avg);
  }

  return flows;
}

// ----------------------------------------------------------------------------
// Budget-kategorisering - hvilke kinds der hører i hver "bucket"
// ----------------------------------------------------------------------------
// Account kinds we surface i /budget. Excludes:
//   - 'household': har sin egen side (/husholdning) til daily-spend tracking
//   - 'savings'/'investment': vises som "Opsparinger & buffer"-sektion på
//     /budget - de modtager indskud, ikke udgifter
//   - 'credit': payments go TO, not FROM - håndteres på /laan
//   - 'cash': sjælden
// Brugere der alligevel vil registrere udgifter på en af de udelukkede
// kinds kan bruge /poster direkte.
export const BUDGET_ACCOUNT_KINDS: AccountKind[] = ['checking', 'budget', 'other'];

// Kinds vi viser i "Opsparinger & buffer"-sektionen - det er konti man
// IKKE bruger fra, men overfører TIL. Sektionen hjælper brugeren se hvilke
// konti der mangler en månedlig overførsel.
export const SAVINGS_ACCOUNT_KINDS: AccountKind[] = ['savings', 'investment'];

export type BudgetAccount = Pick<Account, 'id' | 'name' | 'owner_name' | 'kind'>;

export async function getBudgetAccounts(): Promise<BudgetAccount[]> {
  const p = await getPerspective();
  let q = p.supabase
    .from('accounts')
    .select('id, name, owner_name, kind')
    .eq('household_id', p.householdId)
    .eq('archived', false)
    .in('kind', BUDGET_ACCOUNT_KINDS);
  q = q.or(privateAccountFilter(p));
  const { data, error } = await q.order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Opsparings/investerings-konti med deres månedlige indkomne overførsel
// (sum af recurring transfers ind, normaliseret til kr/md). Bruges af
// "Opsparinger & buffer"-sektionen på /budget overview til at vise hvilke
// konti der mangler en månedlig overførsel.
export type SavingsAccountWithFlow = Account & {
  monthlyInflow: number;
  investment_type: Account['investment_type'];
};

export async function getSavingsAccountsWithFlow(): Promise<SavingsAccountWithFlow[]> {
  const p = await getPerspective();
  const visibleAccountIds = await getVisibleAccountIds();
  if (visibleAccountIds && visibleAccountIds.length === 0) return [];

  let accountsQ = p.supabase
    .from('accounts')
    .select('*')
    .eq('household_id', p.householdId)
    .eq('archived', false)
    .in('kind', SAVINGS_ACCOUNT_KINDS);
  accountsQ = accountsQ.or(privateAccountFilter(p));

  let transfersQ = p.supabase
    .from('transfers')
    .select('to_account_id, amount, recurrence')
    .eq('household_id', p.householdId)
    .neq('recurrence', 'once');
  if (visibleAccountIds) {
    transfersQ = transfersQ.or(
      `from_account_id.in.(${visibleAccountIds.join(',')}),to_account_id.in.(${visibleAccountIds.join(',')})`
    );
  }

  const [accountsRes, transfersRes] = await Promise.all([
    accountsQ.order('created_at', { ascending: true }),
    transfersQ,
  ]);

  if (accountsRes.error) throw accountsRes.error;
  if (transfersRes.error) throw transfersRes.error;

  const inflowByAccount = new Map<string, number>();
  for (const tr of transfersRes.data ?? []) {
    const monthly = monthlyEquivalent(tr.amount, tr.recurrence);
    inflowByAccount.set(
      tr.to_account_id,
      (inflowByAccount.get(tr.to_account_id) ?? 0) + monthly
    );
  }

  return (accountsRes.data ?? []).map((a) => ({
    ...a,
    monthlyInflow: inflowByAccount.get(a.id) ?? 0,
  }));
}
