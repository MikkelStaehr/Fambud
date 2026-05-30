// Cashflow-graph - pengestrømmen mellem konti.
//
// Detaljeret cashflow-data til Sankey-graf-visualiseringen på dashboardet.
// Forskellen fra getAccountFlows() (i accounts.ts) er at vi separerer
// income/expense (eksterne kanter til/fra synthetic "Indtægter"/"Udgifter"-
// noder) fra transfers (kanter mellem konti). Den aggregerede in/out i
// flows gjorde det umuligt at tegne grafen korrekt - hvis vi blot tegnede
// in→Udgifter ville en transfer til en opsparingskonto fejlagtigt blive
// vist som en udgift.
//
// Andre cashflow-aggregater (dashboard-totals, advisor-context, kategori-
// fordeling, top-N, upcoming events) er splittet ud i deres egne moduler:
//   - dashboard.ts          - getDashboardData, getHouseholdFinancialSummary
//   - advisor.ts            - getAdvisorContext + per-bidragyder-splits
//   - expenses-by-category.ts - getMonthlyExpensesByCategory/Group/Top
//   - upcoming-events.ts    - getUpcomingEvents
// Alle importerer getCashflowGraph herfra hvis de skal bruge cashflow-data.

import { cache } from 'react';
import type { RecurrenceFreq } from '@/lib/database.types';
import { effectiveAmount, monthlyEquivalent } from '@/lib/format';
import { getPerspective, getVisibleAccountIds } from './auth';

export type AccountCashflowDetail = {
  income: number;        // monthlyEquivalent af kategori=income transaktioner (husstands-totaler)
  myIncome: number;      // som income, men paychecks filtreret til den indloggede brugers egne
  expense: number;       // monthlyEquivalent af kategori=expense transaktioner
  transfersIn: number;   // monthlyEquivalent af indgående overførsler
  transfersOut: number;  // monthlyEquivalent af udgående overførsler
};

export type CashflowEdge = {
  from: string;          // account id (eller 'income' synthetic)
  to: string;            // account id (eller 'expense' synthetic)
  monthly: number;
  kind: 'income' | 'expense' | 'transfer';
};

export type CashflowGraphData = {
  perAccount: Map<string, AccountCashflowDetail>;
  edges: CashflowEdge[];
};

// cache() memoizer pr. React-request, så getDashboardData og dashboard-page
// der begge læser cashflow-data ikke laver dobbelt round-trip mod DB'en.
export const getCashflowGraph = cache(async (): Promise<CashflowGraphData> => {
  // I proxy-mode: perspectiveUserId = grantorens id (Louise), så "myIncome"
  // bliver hendes løn-paychecks. supabase = admin-client; vi gen-applyer
  // privacy via visibleAccountIds.
  const p = await getPerspective();
  const visibleAccountIds = p.isProxyActive ? await getVisibleAccountIds() : null;
  if (visibleAccountIds && visibleAccountIds.length === 0) {
    return { perAccount: new Map(), edges: [] };
  }

  // Vi henter fire datasæt parallelt:
  //   1. Recurring (ikke-once) transaktioner - almindelig income/expense
  //      hvor monthlyEquivalent giver mening
  //   2. Recurring transfers - transfers mellem konti (også monthlyEquivalent)
  //   3. Primary-once paychecks - individuelle lønudbetalinger som er gemt
  //      med recurrence='once'. De har ikke en "monthly recurrence" men vi
  //      bruger gennemsnit af de seneste 3 som forecast pr. konto, så
  //      lønindkomst dukker op i grafen lige som den tidligere
  //      "Månedsløn"-recurring-transaktion gjorde.
  //   4. Min egen family_member id - bruges til at separere "myIncome"
  //      (mine paychecks) fra "income" (husstandens samlede paychecks).
  //      Dashboard'et viser min personlige cashflow-historie og må ikke
  //      lægge partnerens løn på som min indtægt.
  const myMemberQ = p.supabase
    .from('family_members')
    .select('id')
    .eq('household_id', p.householdId)
    .eq('user_id', p.perspectiveUserId)
    .maybeSingle();
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

  const [myMemberRes, txnsRes, transfersRes, paychecksRes] = await Promise.all([
    myMemberQ,
    (visibleAccountIds ? txnsQ.in('account_id', visibleAccountIds) : txnsQ).returns<{
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
    (visibleAccountIds ? paychecksQ.in('account_id', visibleAccountIds) : paychecksQ).returns<{
      account_id: string;
      family_member_id: string | null;
      amount: number;
      occurs_on: string;
    }[]>(),
  ]);

  if (myMemberRes.error) throw myMemberRes.error;
  if (txnsRes.error) throw txnsRes.error;
  if (transfersRes.error) throw transfersRes.error;
  if (paychecksRes.error) throw paychecksRes.error;

  const myMemberId = myMemberRes.data?.id ?? null;

  const perAccount = new Map<string, AccountCashflowDetail>();
  const detailFor = (id: string) => {
    let d = perAccount.get(id);
    if (!d) {
      d = { income: 0, myIncome: 0, expense: 0, transfersIn: 0, transfersOut: 0 };
      perAccount.set(id, d);
    }
    return d;
  };

  // Aggregér income/expense pr. konto (kanten Indtægter→konto eller
  // konto→Udgifter er summen af alle transaktioner, ikke én pr. række).
  // Recurring income er konto-niveau (ingen member-attribution) - vi tæller
  // det med i både income og myIncome fordi "hvad lander på kontoen" er det
  // samme fra min synsvinkel.
  for (const t of txnsRes.data ?? []) {
    const eff = effectiveAmount(t.amount, t.components ?? [], t.components_mode);
    const monthly = monthlyEquivalent(eff, t.recurrence);
    if (t.category?.kind === 'income') {
      const d = detailFor(t.account_id);
      d.income += monthly;
      d.myIncome += monthly;
    } else if (t.category?.kind === 'expense') {
      detailFor(t.account_id).expense += monthly;
    }
  }

  // Forecast fra primary-once paychecks: gruppér efter (account, member),
  // tag de seneste 3 og brug gennemsnit som månedlig income. Det matcher
  // PrimaryIncomeForecast-logikken i income.ts. Hvis der er færre end 3
  // paychecks, bruger vi gennemsnittet af det vi har - bedre end ingenting,
  // selvom forecastet er mindre præcist.
  //
  // Vi sporer member-id pr. gruppe så vi kan tilføje paycheck-gennemsnittet
  // til "myIncome" KUN hvis det er den indloggede brugers egne paychecks.
  // Det er dén regel der gør at en delt lønkonto ikke fejlagtigt får begge
  // medlemmers lønninger lagt sammen som "min indtægt".
  const paycheckGroups = new Map<string, { memberId: string | null; amounts: number[] }>();
  for (const p of paychecksRes.data ?? []) {
    const key = `${p.account_id}|${p.family_member_id ?? ''}`;
    let grp = paycheckGroups.get(key);
    if (!grp) {
      grp = { memberId: p.family_member_id, amounts: [] };
      paycheckGroups.set(key, grp);
    }
    if (grp.amounts.length < 3) grp.amounts.push(p.amount);
  }
  for (const [key, { memberId, amounts }] of paycheckGroups) {
    if (amounts.length === 0) continue;
    const accountId = key.split('|')[0];
    const avg = Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length);
    const d = detailFor(accountId);
    d.income += avg;
    if (memberId != null && memberId === myMemberId) {
      d.myIncome += avg;
    }
  }

  // Transfers tæller mod hver kontos in/out aggregat (perAccount), MEN vi
  // beholder dem som separate kanter i `edges` så grafen viser flere
  // strømme der peger på samme destination som adskilte bånd.
  //
  // Dette er bevidst forskelligt fra den tidligere adfærd hvor (from, to)
  // blev summeret. Når brugeren har én Bufferkonto der modtager BÅDE en
  // buffer-overførsel og en forudsigelige-uforudsete-overførsel, skal de
  // to pengestrømme stå som to separate bånd i Sankey'en - ikke som én
  // klumpet linje.
  const transferEdges: CashflowEdge[] = [];
  for (const tr of transfersRes.data ?? []) {
    const monthly = monthlyEquivalent(tr.amount, tr.recurrence);
    detailFor(tr.from_account_id).transfersOut += monthly;
    detailFor(tr.to_account_id).transfersIn += monthly;
    transferEdges.push({
      from: tr.from_account_id,
      to: tr.to_account_id,
      monthly,
      kind: 'transfer',
    });
  }

  // Byg kant-listen. Synthetic node-ids: 'income' (kilden) og 'expense'
  // (slutter). De håndteres specielt i graf-komponenten.
  const edges: CashflowEdge[] = [];
  for (const [accountId, d] of perAccount) {
    if (d.income > 0) edges.push({ from: 'income', to: accountId, monthly: d.income, kind: 'income' });
    if (d.expense > 0) edges.push({ from: accountId, to: 'expense', monthly: d.expense, kind: 'expense' });
  }
  edges.push(...transferEdges);

  return { perAccount, edges };
});
