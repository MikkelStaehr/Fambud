import {
  getAccounts,
  getAdvisorContext,
  getCashflowGraph,
  getCurrentMemberFirstName,
  getDashboardData,
  getFamilyMembers,
  getMonthlyExpensesByGroup,
  getMyMembership,
  getOnboardingProgress,
  getOtherMembersOnboardingStatus,
  getPrimaryIncomeForecast,
  getUpcomingEvents,
} from '@/lib/dal';
import {
  formatLongDateDA,
  formatMonthYearDA,
} from '@/lib/format';
import { buildFixFor, detectCashflowIssues } from '@/lib/cashflow-analysis';
import { InfoTooltip } from '@/app/_components/InfoTooltip';
import { CashflowGraph } from './_components/CashflowGraph';
import { CashflowWarnings } from './_components/CashflowWarnings';
import { CategoryGroupChart } from './_components/CategoryGroupChart';
import { DashboardTour } from './_components/DashboardTour';
import { FamilyStatus } from './_components/FamilyStatus';
import { HeroStatus } from './_components/HeroStatus';
import { IncomeForecastBanner } from './_components/IncomeForecastBanner';
import { OnboardingChecklist } from './_components/OnboardingChecklist';
import { UpcomingEvents } from './_components/UpcomingEvents';

// Tidsbestemt hilsen - dansk, fire buckets der dækker normale vågne timer.
// "Godnat" er en farvel-frase på dansk, ikke en hilsen, så vi falder tilbage
// til "Hej" om natten i stedet.
function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h >= 5 && h < 10) return 'Godmorgen';
  if (h >= 10 && h < 18) return 'Goddag';
  if (h >= 18 && h < 22) return 'Godaften';
  return 'Hej';
}

export default async function DashboardPage() {
  // Alt dashboard-data hentes parallelt. getCashflowGraph() returnerer
  // memoized data via React's cache() så både getDashboardData (intern
  // monthlyTotals-aggregering) og CashflowGraph-rendering deler én DB-tur.
  const [
    { monthlyTotals, yearMonth },
    onboardingProgress,
    firstName,
    accounts,
    graph,
    ctx,
    expenseGroups,
    upcomingEvents,
    familyMembers,
    otherMembersStatus,
  ] = await Promise.all([
    getDashboardData(),
    getOnboardingProgress(),
    getCurrentMemberFirstName(),
    getAccounts(),
    getCashflowGraph(),
    getAdvisorContext(),
    getMonthlyExpensesByGroup(),
    getUpcomingEvents(),
    getFamilyMembers(),
    getOtherMembersOnboardingStatus(),
  ]);
  // Tour-state - auto-start hvis brugeren ikke har set rundturen endnu
  // (men kun efter wizard er færdig, så vi ikke spammer dem mens de
  // stadig sætter op).
  const { membership } = await getMyMembership();
  const shouldAutoStartTour =
    membership?.setup_completed_at != null &&
    membership?.tour_completed_at == null;

  // "Manglende bidragydere" til HeroStatus: familiemedlemmer der har sat
  // primary_income_source men endnu ikke har én eneste paycheck registreret.
  // Når der er sådanne, er et tilsyneladende underskud sandsynligvis bare
  // "venter på data" og bør ikke alarmere.
  const incomeContributors = familyMembers.filter(
    (m) => m.primary_income_source != null
  );
  const forecastChecks = await Promise.all(
    incomeContributors.map(async (m) => ({
      member: m,
      forecast: await getPrimaryIncomeForecast(m.id),
    }))
  );
  const missingIncomeContributors = forecastChecks
    .filter((f) => f.forecast.paychecksUsed === 0)
    .map((f) => f.member.name);

  const issues = detectCashflowIssues(accounts, graph.perAccount);
  const fixes = issues
    .map((issue) => ({ issue, fix: buildFixFor(issue, accounts, graph.perAccount, ctx) }))
    .filter((entry) => entry.fix !== null) as {
    issue: typeof issues[number];
    fix: NonNullable<ReturnType<typeof buildFixFor>>;
  }[];
  const visibleAccounts = accounts.filter(
    (a) => !a.archived && a.kind !== 'credit'
  );
  const deficitAccountIds = new Set(fixes.map((f) => f.issue.account.id));

  const today = new Date();
  const longDate = formatLongDateDA(today);
  const longDateCapitalised = longDate.charAt(0).toUpperCase() + longDate.slice(1);
  const monthLabel = formatMonthYearDA(yearMonth);
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const greeting = greetingFor(today);
  const personalGreeting = firstName ? `${greeting}, ${firstName}` : greeting;

  const { income, expense, net } = monthlyTotals;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <DashboardTour
        ownerName={firstName}
        autoStart={shouldAutoStartTour}
      />
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          {personalGreeting}
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">{longDateCapitalised}</p>
      </header>

      {/* Onboarding-checklisten viser de fundamentale trin der mangler efter
          wizard. Skjuler sig selv når alle tre er færdige. Erstattede den
          tidligere enkelt-CTA "Lad os fylde budgettet op" så brugeren ser
          hele post-wizard rejsen, ikke bare det første trin. */}
      <OnboardingChecklist progress={onboardingProgress} />

      <FamilyStatus members={otherMembersStatus} />

      <IncomeForecastBanner />

      {/* Tier 1 - det brugeren skal se lynhurtigt:
          1. HeroStatus: "Er du på rette spor?" (netto + statustekst)
          2. Cashflow-tjek (advarsler - kompakt, fuld bredde)
          3. To-kolonne: Næste 7 dage + Udgifter pr. gruppe */}
      <HeroStatus
        income={income}
        expense={expense}
        net={net}
        monthLabel={monthCap}
        missingIncomeContributors={missingIncomeContributors}
      />

      <div className="mt-8">
        <CashflowWarnings
          fixes={fixes}
          pendingMembers={ctx.pendingMembers}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingEvents events={upcomingEvents} />
        <CategoryGroupChart
          privateGroups={expenseGroups.private}
          sharedGroups={expenseGroups.shared}
        />
      </div>

      <section data-tour="cashflow-graph" className="mt-8">
        <h2 className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Pengestrøm
          <InfoTooltip>
            Sankey-graf der viser hvordan pengene flyder fra jeres
            lønkonto(er) til private udgifter, fælleskonti og opsparing.
            Bredden af hvert bånd er proportional med beløbet pr. måned.
            Bygget på recurring transaktioner + forecast af lønudbetalinger.
          </InfoTooltip>
        </h2>
        <CashflowGraph
          accounts={visibleAccounts}
          graph={graph}
          deficitAccountIds={deficitAccountIds}
        />
      </section>
    </div>
  );
}
