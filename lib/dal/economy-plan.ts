// Data-aggregering til økonomi-rådgiveren (/raadgiver). Komponerer de
// eksisterende cachede DAL-funktioner til ét samlet svar, så rådgiver-siden
// kun har én await. Den rene anbefalings-logik lever i lib/economy-plan.ts;
// her henter og former vi bare rådata.

import { monthlyEquivalent } from '@/lib/format';
import { computePrivatFaelles } from '@/lib/cashflow-analysis';
import { getPerspective } from './auth';
import { getCashflowGraph } from './cashflow';
import { getAdvisorContext } from './advisor';
import { getAccounts } from './accounts';
import { getFamilyMembers, getOtherMembersOnboardingStatus } from './family';
import { getPrimaryIncomeForecast } from './income';
import { getHouseholdFinancialSummary } from './dashboard';
import { getLoans } from './loans';
import { getMonthlyExpensesByGroup } from './expenses-by-category';
import type { PlanMember, MemberSetupStatus } from '@/lib/economy-plan';
import type { CategoryGroup } from '@/lib/categories';

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
  // Dyreste lån (højeste rente) - til "ekstra afdrag her sparer mest"-råd,
  // med restgæld + ydelse så vi kan beregne håndgribelig effekt.
  mostExpensiveLoan: {
    name: string;
    rate: number;
    balance: number;        // restgæld (øre)
    monthlyPayment: number; // ydelse normaliseret til kr/md (øre)
  } | null;
  // Alle lån - til låneoptimering (avalanche vs snowball).
  loans: {
    id: string;
    name: string;
    balance: number;
    // rate = den effektive omkostning (ÅOP foretrukket) til at RANGERE lån
    // efter, hvad der er dyrest. interestRate = den nominelle rente til
    // VISNING (fx i finansrapporten), så vi ikke kalder ÅOP for "rente".
    rate: number | null;
    interestRate: number | null;
    monthlyPayment: number;
  }[];
  // Den indloggede brugers uallokerede overskud/md (= dashboardets "tilbage
  // hver måned"): indkomst minus privat forbrug minus alle overførsler ud.
  // Det er de penge der reelt er fri til at allokere.
  privatSurplus: number;
  // Den indloggede brugers private udgifter pr. kategori-gruppe - til
  // 50/30/20-modellen. (Partnerens private udgifter er skjult via RLS, så
  // dette er kun brugerens egne grupper.)
  privateExpenseGroups: { group: CategoryGroup; monthly: number }[];
  // Den indloggede brugers egen opsætnings-status - til "manglende opsætning".
  myHasLonkonto: boolean;
  myHasAnyIncome: boolean;
  myIncomeComplete: boolean;
  // Øvrige husstandsmedlemmers status (samme kilde som dashboardets
  // FamilyStatus, så rådgiveren er konsistent med den).
  memberStatuses: MemberSetupStatus[];
  // Brugerens lønkonto - kilde til de Opret-overførsler rådgiveren foreslår.
  suggestedSourceId: string | null;
  suggestedSourceName: string | null;
  // Fælleskonti der modtager bidrag (Opret-destinationer).
  faellesAccounts: { id: string; name: string }[];
  // Foretrukket destination til "Opret fælles-overførsel"-CTA. Vi vælger
  // budget-kontoen først (det er hvor faste udgifter bør trækkes), så
  // husholdning, så første tilgængelige. null hvis der ingen fælleskonti er.
  primaryFaellesAccountId: string | null;
  primaryFaellesAccountName: string | null;
  // Husholdnings-konto (fælles kind='household'): adskilt fra Budget fordi
  // den modtager sin egen månedlige overførsel til daglig forbrug.
  // Rådgiveren viser separat "TIL HUSHOLDNING"-CTA per person.
  husholdningAccountId: string | null;
  husholdningAccountName: string | null;
  // Husholdningens månedlige obligation: helst monthly_budget hvis sat
  // (bevidst intent), ellers faktiske expenses som fallback. Splittes
  // mellem bidragydere via samme model som udgifter.
  husholdningMonthly: number;
  currentUserId: string;
};

export async function getEconomyPlanData(): Promise<EconomyPlanData> {
  // Perspective-aware: i proxy-mode er "jeg" Louise (perspectiveUserId),
  // ikke Mikkel (authUserId). Rådgiveren skal vise HENDES lønkonto,
  // HENDES privatSurplus, HENDES meMember-status så Mikkel kan koordinere.
  const p = await getPerspective();
  const perspectiveUserId = p.perspectiveUserId;

  const [
    familyMembers,
    graph,
    ctx,
    accounts,
    financial,
    loans,
    expenseGroups,
    memberStatuses,
  ] = await Promise.all([
    getFamilyMembers(),
    getCashflowGraph(),
    getAdvisorContext(),
    getAccounts(),
    getHouseholdFinancialSummary(),
    getLoans(),
    getMonthlyExpensesByGroup(),
    getOtherMembersOnboardingStatus(),
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

  // Primær destination til fælles-bidrags-overførsler. Budget-kontoen er
  // standardvalget (det er hvor de faste regninger trækkes); ellers
  // husholdning; ellers første fælleskonto.
  const primaryFaelles =
    faellesAccountList.find((a) => a.kind === 'budget') ??
    faellesAccountList.find((a) => a.kind === 'household') ??
    faellesAccountList[0] ??
    null;

  // Samlede fælles udgifter + indgående overførsler fra cashflow-grafen.
  // Husholdning splittes ud separat (egen overførsel-anbefaling) så vi
  // ikke pretender at Budget hub'er den.
  let faellesMonthlyExpense = 0;
  let faellesCurrentInflow = 0;
  let husholdningMonthly = 0;
  let husholdningAccount: typeof faellesAccountList[number] | undefined;
  for (const a of faellesAccountList) {
    const d = graph.perAccount.get(a.id);
    if (a.kind === 'household') {
      husholdningAccount = a;
      // monthly_budget = intent (hvad husstanden gerne vil bruge per md).
      // Hvis ikke sat, fald tilbage til faktiske expenses som proxy.
      husholdningMonthly = a.monthly_budget ?? (d?.expense ?? 0);
      continue;  // husholdning indgår ikke i faellesMonthlyExpense
    }
    if (!d) continue;
    faellesMonthlyExpense += d.expense;
    faellesCurrentInflow += d.transfersIn;
  }

  // Nuværende bidrag pr. medlem: sum af deres overførsler til fælleskonti
  // (grupperet via from-kontoens creator i advisor-context). Splittes
  // efter destinations-kontotype så rådgiveren kan vise "udgifter" vs
  // "opsparing" som apples-to-apples med de splittede anbefalinger.
  // 3 buckets: expense (Budget+andet), husholdning (household), savings.
  const expenseFaellesIds = new Set(
    faellesAccountList
      .filter(
        (a) =>
          a.kind !== 'savings' &&
          a.kind !== 'investment' &&
          a.kind !== 'household'
      )
      .map((a) => a.id)
  );
  const husholdningFaellesIds = new Set(
    faellesAccountList.filter((a) => a.kind === 'household').map((a) => a.id)
  );
  const savingsFaellesIds = new Set(
    faellesAccountList
      .filter((a) => a.kind === 'savings' || a.kind === 'investment')
      .map((a) => a.id)
  );
  const contributionByUser = new Map<
    string,
    { total: number; expense: number; husholdning: number; savings: number }
  >();
  const bumpUser = (
    userId: string,
    bucket: 'expense' | 'husholdning' | 'savings',
    amount: number
  ) => {
    const prev =
      contributionByUser.get(userId) ?? {
        total: 0,
        expense: 0,
        husholdning: 0,
        savings: 0,
      };
    prev.total += amount;
    prev[bucket] += amount;
    contributionByUser.set(userId, prev);
  };
  for (const t of ctx.transfersByCreator) {
    if (t.creatorUserId == null) continue;
    if (expenseFaellesIds.has(t.toAccountId)) {
      bumpUser(t.creatorUserId, 'expense', t.monthly);
    } else if (husholdningFaellesIds.has(t.toAccountId)) {
      bumpUser(t.creatorUserId, 'husholdning', t.monthly);
    } else if (savingsFaellesIds.has(t.toAccountId)) {
      bumpUser(t.creatorUserId, 'savings', t.monthly);
    }
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
    // Find medlemmets egen lønkonto: checking-konto oprettet af deres user_id.
    // Skal kunne bruges som from-konto i en foreslået overførsel til fælles.
    const memberLonkonto = m.user_id
      ? accounts.find(
          (a) =>
            a.kind === 'checking' &&
            a.created_by === m.user_id &&
            !a.archived
        )
      : null;
    const contrib = m.user_id ? contributionByUser.get(m.user_id) : undefined;
    return {
      id: m.id,
      name: m.name,
      userId: m.user_id,
      monthlyIncome,
      incomeComplete: f.status === 'ready',
      currentContribution: contrib?.total ?? 0,
      currentToExpenseAccounts: contrib?.expense ?? 0,
      currentToHusholdningAccounts: contrib?.husholdning ?? 0,
      currentToSavingsAccounts: contrib?.savings ?? 0,
      lonkontoId: memberLonkonto?.id ?? null,
      lonkontoName: memberLonkonto?.name ?? null,
    };
  });

  // Perspective-brugerens lønkonto = foreslået kilde til Opret-overførsler.
  // I proxy-mode peger denne på Louises lønkonto (ikke Mikkels) så
  // "Opsæt overførsel"-CTAen pre-udfylder formen med hendes konto.
  const myLonkonto = accounts.find(
    (a) => a.kind === 'checking' && a.created_by === perspectiveUserId && !a.archived
  );

  // Den indloggede perspectives egen status (til "manglende opsætning").
  const meMember = members.find((m) => m.userId === perspectiveUserId);

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

  // Dyreste lån = højeste rente (apr foretrukket, ellers interest_rate).
  // Restgæld = abs(opening_balance) (samme som /laan viser).
  let mostExpensiveLoan: EconomyPlanData['mostExpensiveLoan'] = null;
  for (const l of loans) {
    const rate = l.apr ?? l.interest_rate;
    if (rate == null) continue;
    if (!mostExpensiveLoan || rate > mostExpensiveLoan.rate) {
      mostExpensiveLoan = {
        name: l.name,
        rate,
        balance: Math.abs(l.opening_balance),
        monthlyPayment: l.payment_amount
          ? monthlyEquivalent(l.payment_amount, l.payment_interval)
          : 0,
      };
    }
  }

  // Perspective-brugerens uallokerede overskud (samme tal som dashboardets
  // Privat-panel "tilbage hver måned"). I proxy-mode: Louises overskud.
  const privatSurplus = computePrivatFaelles(
    accounts,
    graph.perAccount,
    perspectiveUserId
  ).privat.net;

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
    mostExpensiveLoan,
    loans: loans.map((l) => ({
      id: l.id,
      name: l.name,
      balance: Math.abs(l.opening_balance),
      rate: l.apr ?? l.interest_rate,
      interestRate: l.interest_rate,
      monthlyPayment: l.payment_amount
        ? monthlyEquivalent(l.payment_amount, l.payment_interval)
        : 0,
    })),
    privatSurplus,
    privateExpenseGroups: expenseGroups.private.map((g) => ({
      group: g.group,
      monthly: g.monthly,
    })),
    myHasLonkonto: myLonkonto != null,
    myHasAnyIncome: (meMember?.monthlyIncome ?? 0) > 0,
    myIncomeComplete: meMember?.incomeComplete ?? false,
    memberStatuses: memberStatuses.map((s) => ({
      name: s.name,
      hasLogin: s.hasLogin,
      hasOwnCheckingAccount: s.hasOwnCheckingAccount,
      paycheckCount: s.paycheckCount,
    })),
    suggestedSourceId: myLonkonto?.id ?? null,
    suggestedSourceName: myLonkonto?.name ?? null,
    faellesAccounts: faellesAccountList.map((a) => ({ id: a.id, name: a.name })),
    primaryFaellesAccountId: primaryFaelles?.id ?? null,
    primaryFaellesAccountName: primaryFaelles?.name ?? null,
    husholdningAccountId: husholdningAccount?.id ?? null,
    husholdningAccountName: husholdningAccount?.name ?? null,
    husholdningMonthly,
    currentUserId: perspectiveUserId,
  };
}
