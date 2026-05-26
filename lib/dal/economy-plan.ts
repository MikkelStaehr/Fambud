// Data-aggregering til økonomi-rådgiveren (/raadgiver). Komponerer de
// eksisterende cachede DAL-funktioner til ét samlet svar, så rådgiver-siden
// kun har én await. Den rene anbefalings-logik lever i lib/economy-plan.ts;
// her henter og former vi bare rådata.

import { monthlyEquivalent } from '@/lib/format';
import { getHouseholdContext } from './auth';
import { getCashflowGraph } from './cashflow';
import { getAdvisorContext } from './advisor';
import { getAccounts } from './accounts';
import { getFamilyMembers } from './family';
import { getPrimaryIncomeForecast } from './income';
import { getHouseholdFinancialSummary } from './dashboard';
import { getLoans } from './loans';
import type { PlanMember } from '@/lib/economy-plan';

export type EconomyPlanData = {
  members: PlanMember[];
  // Samlede fælles udgifter/md og hvad der pt. overføres ind til fælles.
  faellesMonthlyExpense: number;
  faellesCurrentInflow: number;
  // Husstandens samlede faste udgifter - grundlag for buffer-anbefaling.
  monthlyFixedExpenses: number;
  // Buffer-konto: nuværende månedlige indskud (flow, ikke saldo). Bruges til
  // at vise hvor lang tid der går før 3-mdr.-bufferen er nået.
  bufferMonthlyContribution: number;
  bufferAccountId: string | null;
  bufferAccountName: string | null;
  // Lån: samlet månedlig afdragsbyrde. Bruges til at give realistiske
  // opsparings-råd - lån der afvikles frigør cashflow til bufferen, så vi
  // ikke naivt foreslår at "finde" nye penge i budgettet.
  monthlyLoanPayments: number;
  hasLoans: boolean;
  // Brugerens lønkonto - kilde til de Opret-overførsler rådgiveren foreslår.
  suggestedSourceId: string | null;
  suggestedSourceName: string | null;
  // Fælleskonti der modtager bidrag (Opret-destinationer).
  faellesAccounts: { id: string; name: string }[];
  currentUserId: string;
};

export async function getEconomyPlanData(): Promise<EconomyPlanData> {
  const { user } = await getHouseholdContext();

  const [familyMembers, graph, ctx, accounts, financial, loans] =
    await Promise.all([
      getFamilyMembers(),
      getCashflowGraph(),
      getAdvisorContext(),
      getAccounts(),
      getHouseholdFinancialSummary(),
      getLoans(),
    ]);

  // Bidragydere = voksne der enten er logget ind eller pre-godkendt via
  // email. Børn (begge null) bidrager ikke økonomisk og udelades.
  const contributors = familyMembers.filter(
    (m) => m.user_id != null || m.email != null
  );

  // Indkomst pr. bidragyder via forecast (gennemsnit af 3 seneste lønsedler).
  const forecasts = await Promise.all(
    contributors.map((m) => getPrimaryIncomeForecast(m.id))
  );

  // Fælleskonti: ejet af 'Fælles', ikke arkiveret, ikke lån.
  const faellesAccountList = accounts.filter(
    (a) => a.owner_name === 'Fælles' && !a.archived && a.kind !== 'credit'
  );
  const faellesAccountIds = new Set(faellesAccountList.map((a) => a.id));

  // Samlede fælles udgifter + indgående overførsler fra cashflow-grafen.
  let faellesMonthlyExpense = 0;
  let faellesCurrentInflow = 0;
  for (const a of faellesAccountList) {
    const d = graph.perAccount.get(a.id);
    if (!d) continue;
    faellesMonthlyExpense += d.expense;
    faellesCurrentInflow += d.transfersIn;
  }

  // Nuværende bidrag pr. medlem: sum af deres overførsler til fælleskonti
  // (grupperet via from-kontoens creator i advisor-context).
  const contributionByUser = new Map<string, number>();
  for (const t of ctx.transfersByCreator) {
    if (t.creatorUserId == null) continue;
    if (!faellesAccountIds.has(t.toAccountId)) continue;
    contributionByUser.set(
      t.creatorUserId,
      (contributionByUser.get(t.creatorUserId) ?? 0) + t.monthly
    );
  }

  const members: PlanMember[] = contributors.map((m, i) => {
    const f = forecasts[i];
    const monthlyIncome =
      f.status === 'ready'
        ? f.monthlyNet
        : f.samples.length > 0
          ? Math.round(
              f.samples.reduce((s, p) => s + p.amount, 0) / f.samples.length
            )
          : 0;
    return {
      id: m.id,
      name: m.name,
      userId: m.user_id,
      monthlyIncome,
      incomeComplete: f.status === 'ready',
      currentContribution: m.user_id
        ? contributionByUser.get(m.user_id) ?? 0
        : 0,
    };
  });

  // Brugerens egen lønkonto = foreslået kilde til Opret-overførsler.
  const myLonkonto = accounts.find(
    (a) => a.kind === 'checking' && a.created_by === user.id && !a.archived
  );

  // Buffer-konto: foretræk savings_purposes='buffer', ellers navn der
  // indeholder "buffer". Nuværende månedlige indskud = transfersIn (flow).
  const bufferAccount =
    accounts.find(
      (a) =>
        a.kind === 'savings' &&
        !a.archived &&
        (a.savings_purposes ?? []).includes('buffer')
    ) ??
    accounts.find(
      (a) =>
        a.kind === 'savings' &&
        !a.archived &&
        a.name.toLowerCase().includes('buffer')
    );
  const bufferMonthlyContribution = bufferAccount
    ? graph.perAccount.get(bufferAccount.id)?.transfersIn ?? 0
    : 0;

  // Samlet månedlig afdragsbyrde (normaliseret til kr/md).
  const monthlyLoanPayments = loans.reduce(
    (sum, l) =>
      sum +
      (l.payment_amount
        ? monthlyEquivalent(l.payment_amount, l.payment_interval)
        : 0),
    0
  );

  return {
    members,
    faellesMonthlyExpense,
    faellesCurrentInflow,
    monthlyFixedExpenses: financial.monthlyFixedExpenses,
    bufferMonthlyContribution,
    bufferAccountId: bufferAccount?.id ?? null,
    bufferAccountName: bufferAccount?.name ?? null,
    monthlyLoanPayments,
    hasLoans: loans.length > 0,
    suggestedSourceId: myLonkonto?.id ?? null,
    suggestedSourceName: myLonkonto?.name ?? null,
    faellesAccounts: faellesAccountList.map((a) => ({ id: a.id, name: a.name })),
    currentUserId: user.id,
  };
}
