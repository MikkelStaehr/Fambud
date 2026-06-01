// Transactions - generic CRUD reads + helpers for the /poster og /budget
// sider. Income- og loan-specifikke queries hører til hhv. income.ts og
// loans.ts.

import type {
  Account,
  Category,
  RecurrenceFreq,
  Transaction,
} from '@/lib/database.types';
import { monthBounds } from '@/lib/format';
import {
  getPerspective,
  privateAccountFilter,
  getVisibleAccountIds,
} from './auth';

// Joined-row shape used by the list view. We use Supabase's nested-select
// syntax and stamp the response type with .returns<>() since our hand-written
// Database type doesn't yet declare Relationships entries.
//
// owner_name er med fordi /poster har Fælles/Private-tabs der splitter på
// kontoens ejerskab (samme regel som dashboard og /budget).
export type TransactionWithRelations = Transaction & {
  account: Pick<Account, 'id' | 'name' | 'owner_name'> | null;
  category: Pick<Category, 'id' | 'name' | 'kind' | 'color'> | null;
};

export async function getTransactionsForMonth(
  yearMonth: string
): Promise<TransactionWithRelations[]> {
  const p = await getPerspective();
  const { start, end } = monthBounds(yearMonth);
  const visibleAccountIds = await getVisibleAccountIds();
  if (visibleAccountIds && visibleAccountIds.length === 0) return [];

  let q = p.supabase
    .from('transactions')
    .select(
      '*, account:accounts(id, name, owner_name), category:categories(id, name, kind, color)'
    )
    .eq('household_id', p.householdId)
    .gte('occurs_on', start)
    .lte('occurs_on', end);
  if (visibleAccountIds) q = q.in('account_id', visibleAccountIds);

  const { data, error } = await q
    .order('occurs_on', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<TransactionWithRelations[]>();

  if (error) throw error;
  return data ?? [];
}

export async function getTransactionById(id: string): Promise<Transaction> {
  const p = await getPerspective();
  const visibleAccountIds = await getVisibleAccountIds();
  let q = p.supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('household_id', p.householdId);
  if (visibleAccountIds) q = q.in('account_id', visibleAccountIds);
  const { data, error } = await q.single();
  if (error) throw error;
  return data;
}

export type ExpenseComponent = {
  id: string;
  label: string;
  amount: number;
  position: number;
  family_member_id: string | null;
  family_member: { id: string; name: string } | null;
};

export type RecurringExpenseRow = {
  id: string;
  amount: number;
  description: string | null;
  occurs_on: string;
  recurrence: RecurrenceFreq;
  category: { id: string; name: string; color: string; kind: string } | null;
  components: ExpenseComponent[];
  group_label: string | null;
  components_mode: 'additive' | 'breakdown';
  family_member_id: string | null;
  family_member: { id: string; name: string } | null;
};

// Recurring (= not 'once') expense-categorised transactions on a single
// account, joined with their components for inline breakdown rendering.
// Filtered to expense-kind categories post-fetch because we can't query
// directly on a joined column's value.
export async function getRecurringExpensesForAccount(
  accountId: string
): Promise<RecurringExpenseRow[]> {
  const p = await getPerspective();
  const visibleAccountIds = await getVisibleAccountIds();
  // I proxy-mode: verifér at den specifikke konto er synlig for perspective.
  // Hvis ikke, returner tomt (caller skulle have RLS-blockeret kontoen)
  if (visibleAccountIds && !visibleAccountIds.includes(accountId)) return [];

  const { data, error } = await p.supabase
    .from('transactions')
    .select(
      'id, amount, description, occurs_on, recurrence, group_label, components_mode, family_member_id, family_member:family_members(id, name), category:categories(id, name, color, kind), components:transaction_components(id, label, amount, position, family_member_id, family_member:family_members(id, name))'
    )
    .eq('household_id', p.householdId)
    .eq('account_id', accountId)
    .neq('recurrence', 'once')
    .order('occurs_on', { ascending: true })
    .returns<RecurringExpenseRow[]>();
  if (error) throw error;

  // Sort each row's components by position so they render in insertion order.
  return (data ?? [])
    .filter((t) => t.category?.kind === 'expense')
    .map((t) => ({
      ...t,
      components: [...(t.components ?? [])].sort((a, b) => a.position - b.position),
    }));
}

// Distinct group_label values for the household - used to populate the
// HTML datalist so users see existing groups (Popermo, TopDanmark, …) when
// adding/editing an expense, reducing typo-driven group splits.
export async function getDistinctExpenseGroups(): Promise<string[]> {
  const p = await getPerspective();
  const visibleAccountIds = await getVisibleAccountIds();
  if (visibleAccountIds && visibleAccountIds.length === 0) return [];
  let q = p.supabase
    .from('transactions')
    .select('group_label')
    .eq('household_id', p.householdId)
    .not('group_label', 'is', null);
  if (visibleAccountIds) q = q.in('account_id', visibleAccountIds);
  const { data, error } = await q;
  if (error) throw error;
  const seen = new Set<string>();
  for (const r of data ?? []) {
    if (r.group_label) seen.add(r.group_label);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, 'da'));
}

// Auto-kategori-forslag: bygger et lookup-table fra "beskrivelse-i-lowercase"
// til "mest brugte kategori-id" baseret på husstandens tidligere poster.
// Spiir-style "vi husker hvad du plejer at kategorisere Netto som". Brugeren
// kan stadig overskrive frit - vi sætter bare en kvalificeret default.
//
// Performance: capper til top-N (vægtet efter brug) så client-bundlen ikke
// vokser ud over kontrol selv for husstande med tusindvis af poster.
export type DescriptionSuggestion = {
  description: string;  // lowercased + trimmed
  categoryId: string;
  count: number;        // antal historiske poster med dette match
};

export async function getDescriptionSuggestions(
  limit = 500
): Promise<DescriptionSuggestion[]> {
  const p = await getPerspective();
  const visibleAccountIds = await getVisibleAccountIds();
  if (visibleAccountIds && visibleAccountIds.length === 0) return [];

  let q = p.supabase
    .from('transactions')
    .select('description, category_id')
    .eq('household_id', p.householdId)
    .not('description', 'is', null)
    .not('category_id', 'is', null);
  if (visibleAccountIds) q = q.in('account_id', visibleAccountIds);
  const { data, error } = await q;
  if (error) throw error;

  // Grupper pr. (description-lowercased, category_id) og tæl forekomster.
  // Vinderen for hver description er den oftest brugte kategori.
  const byDesc = new Map<string, Map<string, number>>();
  for (const t of data ?? []) {
    if (!t.description || !t.category_id) continue;
    const key = t.description.trim().toLowerCase();
    if (!key) continue;
    const cats = byDesc.get(key) ?? new Map<string, number>();
    cats.set(t.category_id, (cats.get(t.category_id) ?? 0) + 1);
    byDesc.set(key, cats);
  }

  const out: DescriptionSuggestion[] = [];
  for (const [desc, cats] of byDesc) {
    let topCat = '';
    let topCount = 0;
    for (const [cat, count] of cats) {
      if (count > topCount) {
        topCat = cat;
        topCount = count;
      }
    }
    out.push({ description: desc, categoryId: topCat, count: topCount });
  }

  // Sorter efter brug (oftest brugte først) og cap.
  out.sort((a, b) => b.count - a.count);
  return out.slice(0, limit);
}

// Abonnement-detektor: finder mønstre i tidligere once-poster der LIGNER en
// fast månedlig udgift som ikke er sat op endnu. Spiir-style "I har betalt
// 99 kr til Netflix de sidste 5 måneder - skal vi tilføje det som fast
// udgift?".
//
// Detektion (konservativ for at undgå falsk-positive):
//   - Group transactions efter (lowercased description, account_id).
//   - Mindst 3 forekomster i mindst 3 DISTINKTE måneder (filtrerer
//     same-month-duplikater og hyppige men ikke-månedlige som dagligvarer).
//   - Beløb-spredning < 20% af median (slår fluktuerende varierende
//     udgifter fra - Netto-køb varierer typisk for meget).
//   - Findes IKKE allerede som recurring expense på samme konto med
//     matchende beskrivelse (undgår "du har allerede sat det op").
export type SubscriptionCandidate = {
  description: string;        // display-version (oprindelig case fra første post)
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
  avgAmount: number;          // øre
  occurrences: number;        // hvor mange gange
  monthsObserved: number;     // distinkte måneder
  lastOccursOn: string;       // YYYY-MM-DD, mest recent
};

export async function getSubscriptionCandidates(
  monthsBack = 6
): Promise<SubscriptionCandidate[]> {
  const p = await getPerspective();
  const visibleAccountIds = await getVisibleAccountIds();
  if (visibleAccountIds && visibleAccountIds.length === 0) return [];

  // Cap til de seneste N måneder så detektoren er hurtig selv ved tusindvis
  // af historiske poster.
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  // Hent once-poster med expense-kategori i vinduet.
  let q = p.supabase
    .from('transactions')
    .select(
      'amount, description, occurs_on, account_id, category_id, account:accounts(name), category:categories(name, kind)'
    )
    .eq('household_id', p.householdId)
    .eq('recurrence', 'once')
    .gte('occurs_on', cutoffIso)
    .not('description', 'is', null)
    .not('category_id', 'is', null);
  if (visibleAccountIds) q = q.in('account_id', visibleAccountIds);
  type Row = {
    amount: number;
    description: string | null;
    occurs_on: string;
    account_id: string;
    category_id: string;
    account: { name: string } | null;
    category: { name: string; kind: 'income' | 'expense' } | null;
  };
  const { data, error } = await q.returns<Row[]>();
  if (error) throw error;

  // Group by (lowercased description, account_id). displayDescription holder
  // den oprindelige casing fra første post så UI/prefill ikke viser "netto"
  // når brugeren skrev "Netto".
  type Bucket = {
    displayDescription: string;
    accountId: string;
    accountName: string;
    amounts: number[];
    months: Set<string>;       // YYYY-MM
    occursDates: string[];
    categoryCounts: Map<string, { count: number; name: string }>;
  };
  const buckets = new Map<string, Bucket>();
  for (const t of data ?? []) {
    if (!t.description || !t.category) continue;
    if (t.category.kind !== 'expense') continue;
    const original = t.description.trim();
    if (!original) continue;
    const desc = original.toLowerCase();
    const key = `${desc}@${t.account_id}`;
    const b =
      buckets.get(key) ?? {
        displayDescription: original,
        accountId: t.account_id,
        accountName: t.account?.name ?? '?',
        amounts: [],
        months: new Set<string>(),
        occursDates: [],
        categoryCounts: new Map<string, { count: number; name: string }>(),
      };
    b.amounts.push(t.amount);
    b.months.add(t.occurs_on.slice(0, 7));
    b.occursDates.push(t.occurs_on);
    const c = b.categoryCounts.get(t.category_id) ?? {
      count: 0,
      name: t.category.name,
    };
    c.count += 1;
    b.categoryCounts.set(t.category_id, c);
    buckets.set(key, b);
  }

  // Hent eksisterende recurring expenses så vi kan filtrere kandidater fra
  // der allerede er sat op. Match på (description-lowercased, account_id).
  const existingRec = await p.supabase
    .from('transactions')
    .select('description, account_id')
    .eq('household_id', p.householdId)
    .neq('recurrence', 'once')
    .not('description', 'is', null);
  if (existingRec.error) throw existingRec.error;
  const existingKeys = new Set<string>();
  for (const r of existingRec.data ?? []) {
    if (!r.description) continue;
    existingKeys.add(`${r.description.trim().toLowerCase()}@${r.account_id}`);
  }

  const candidates: SubscriptionCandidate[] = [];
  for (const [key, b] of buckets) {
    if (existingKeys.has(key)) continue;
    if (b.amounts.length < 3) continue;
    if (b.months.size < 3) continue;
    // Spredning: forskel mellem max og min må højst være 20% af median.
    const sorted = [...b.amounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median <= 0) continue;
    const spread = sorted[sorted.length - 1] - sorted[0];
    if (spread > median * 0.2) continue;
    const avg = Math.round(
      b.amounts.reduce((s, a) => s + a, 0) / b.amounts.length
    );
    // Mest brugte kategori for bucketten.
    let topCatId = '';
    let topCatName = '';
    let topCnt = 0;
    for (const [id, c] of b.categoryCounts) {
      if (c.count > topCnt) {
        topCnt = c.count;
        topCatId = id;
        topCatName = c.name;
      }
    }
    const lastOccurs = b.occursDates
      .slice()
      .sort()
      .pop() as string;
    candidates.push({
      description: b.displayDescription,
      accountId: b.accountId,
      accountName: b.accountName,
      categoryId: topCatId,
      categoryName: topCatName,
      avgAmount: avg,
      occurrences: b.amounts.length,
      monthsObserved: b.months.size,
      lastOccursOn: lastOccurs,
    });
  }

  // Sortér: mest tilbagevendende først, dernæst dyrest.
  candidates.sort((a, b) =>
    b.occurrences - a.occurrences || b.avgAmount - a.avgAmount
  );
  return candidates;
}

// Onboarding-progress: hvilke fundamentale trin har brugeren udført siden
// wizard? Dashboard'et bruger flagene til at vise en checkliste indtil alt
// er på plads. Vi grupperer i én funktion for at undgå multiple roundtrips.
export type OnboardingProgress = {
  // Har den INDLOGGEDE bruger registreret mindst én lønudbetaling? Indkomst
  // er fundamentet - uden den er hele dashboardet 0, og forecastet (som
  // kræver 3 lønsedler) kan ikke beregnes. Derfor er det checklistens
  // første trin.
  hasIncome: boolean;
  hasRecurringExpenses: boolean;
  hasRecurringTransfers: boolean;
  hasBufferAccount: boolean;
};

export async function getOnboardingProgress(): Promise<OnboardingProgress> {
  // I proxy-mode tjekker vi grantorens onboarding (har Louise registreret
  // sin første lønudbetaling?). hasIncome bruger perspectiveUserId til at
  // slå family_member op.
  const p = await getPerspective();
  const visibleAccountIds = await getVisibleAccountIds();

  // Tomme visible-accounts (proxy uden nogen synlige konti) - return defaults.
  if (visibleAccountIds && visibleAccountIds.length === 0) {
    return {
      hasIncome: false,
      hasRecurringExpenses: false,
      hasRecurringTransfers: false,
      hasBufferAccount: false,
    };
  }

  const txnQ = p.supabase
    .from('transactions')
    .select('id, recurrence, category:categories(kind)')
    .eq('household_id', p.householdId)
    .neq('recurrence', 'once');
  const transferQ = p.supabase
    .from('transfers')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', p.householdId)
    .neq('recurrence', 'once');
  const accountQ = p.supabase
    .from('accounts')
    .select('id, savings_purposes')
    .eq('household_id', p.householdId)
    .eq('archived', false);
  const myMemberQ = p.supabase
    .from('family_members')
    .select('id')
    .eq('household_id', p.householdId)
    .eq('user_id', p.perspectiveUserId)
    .maybeSingle();
  const paychecksQ = p.supabase
    .from('transactions')
    .select('family_member_id')
    .eq('household_id', p.householdId)
    .eq('income_role', 'primary')
    .eq('recurrence', 'once');

  const [txnRes, transferRes, accountRes, myMemberRes, paychecksRes] =
    await Promise.all([
      (visibleAccountIds ? txnQ.in('account_id', visibleAccountIds) : txnQ)
        .returns<{ id: string; recurrence: string; category: { kind: string } | null }[]>(),
      visibleAccountIds
        ? transferQ.or(
            `from_account_id.in.(${visibleAccountIds.join(',')}),to_account_id.in.(${visibleAccountIds.join(',')})`
          )
        : transferQ,
      accountQ.or(privateAccountFilter(p))
        .returns<{ id: string; savings_purposes: string[] | null }[]>(),
      myMemberQ,
      (visibleAccountIds ? paychecksQ.in('account_id', visibleAccountIds) : paychecksQ)
        .returns<{ family_member_id: string | null }[]>(),
    ]);

  if (txnRes.error) throw txnRes.error;
  if (transferRes.error) throw transferRes.error;
  if (accountRes.error) throw accountRes.error;
  if (myMemberRes.error) throw myMemberRes.error;
  if (paychecksRes.error) throw paychecksRes.error;

  const myMemberId = myMemberRes.data?.id ?? null;

  return {
    hasIncome:
      myMemberId != null &&
      (paychecksRes.data ?? []).some((p) => p.family_member_id === myMemberId),
    hasRecurringExpenses: (txnRes.data ?? []).some(
      (t) => t.category?.kind === 'expense'
    ),
    hasRecurringTransfers: (transferRes.count ?? 0) > 0,
    hasBufferAccount: (accountRes.data ?? []).some((a) =>
      a.savings_purposes?.includes('buffer')
    ),
  };
}
