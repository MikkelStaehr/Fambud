import {
  getAccounts,
  getAdvisorContext,
  getCashflowGraph,
  getCurrentMemberFirstName,
  getDashboardData,
  getLifeEvents,
  getMonthlyExpenseTrend,
  getMonthlyExpensesByGroup,
  getOnboardingProgress,
  getOtherMembersOnboardingStatus,
  getUpcomingEvents,
  shouldShowTour,
} from '@/lib/dal';
import { getActiveProxyContext } from '@/lib/proxy';
import {
  formatLongDateDA,
  formatMonthYearDA,
} from '@/lib/format';
import {
  buildFixFor,
  computePrivatFaelles,
  detectCashflowIssues,
  diagnoseDeficit,
  type DeficitReason,
} from '@/lib/cashflow-analysis';
import type { CashflowIssue } from '@/lib/cashflow-analysis';
import { InfoTooltip } from '@/app/_components/InfoTooltip';
import { CashflowGraph } from './_components/CashflowGraph';
import { CashflowWarnings } from './_components/CashflowWarnings';
import { CategoryGroupChart } from './_components/CategoryGroupChart';
import { DashboardTour } from './_components/DashboardTour';
import { FamilyStatus } from './_components/FamilyStatus';
import { PrivatFaellesOverview } from './_components/PrivatFaellesOverview';
import { IncomeForecastBanner } from './_components/IncomeForecastBanner';
import { LifeEventsWidget } from './_components/LifeEventsWidget';
import { MonthlyTrendWidget } from './_components/MonthlyTrendWidget';
import { OnboardingChecklist } from './_components/OnboardingChecklist';
import { NextStepsCard } from './_components/NextStepsCard';
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
    { yearMonth },
    onboardingProgress,
    firstName,
    accounts,
    graph,
    ctx,
    expenseGroups,
    upcomingEvents,
    otherMembersStatus,
    lifeEvents,
    monthlyTrend,
    shouldAutoStartTour,
    proxyCtx,
  ] = await Promise.all([
    getDashboardData(),
    getOnboardingProgress(),
    getCurrentMemberFirstName(),
    getAccounts(),
    getCashflowGraph(),
    getAdvisorContext(),
    getMonthlyExpensesByGroup(),
    getUpcomingEvents(),
    getOtherMembersOnboardingStatus(),
    getLifeEvents(),
    getMonthlyExpenseTrend(),
    shouldShowTour('dashboard'),
    getActiveProxyContext(),
  ]);

  const issues = detectCashflowIssues(accounts, graph.perAccount);
  const issuesWithFix = issues.map((issue) => ({
    issue,
    fix: buildFixFor(issue, accounts, graph.perAccount, ctx),
  }));
  const fixes = issuesWithFix.filter((e) => e.fix !== null) as {
    issue: CashflowIssue;
    fix: NonNullable<ReturnType<typeof buildFixFor>>;
  }[];
  // Husstands-niveau underskud hvor BRUGERENS egen andel er dækket
  // (buildFixFor returnerede null), men kontoen samlet set stadig er
  // i underskud - typisk fordi partneren ikke har sat sin halvdel op.
  // Diagnoser hver med forklaring til UI'et.
  const objectiveDeficits: {
    issue: CashflowIssue;
    reason: DeficitReason;
  }[] = issuesWithFix
    .filter((e) => e.fix === null)
    .map((e) => ({
      issue: e.issue,
      reason: diagnoseDeficit(e.issue.account, ctx),
    }));
  const visibleAccounts = accounts.filter(
    (a) => !a.archived && a.kind !== 'credit'
  );
  const deficitAccountIds = new Set([
    ...fixes.map((f) => f.issue.account.id),
    ...objectiveDeficits.map((d) => d.issue.account.id),
  ]);

  // Privat/Fælles-oversigten: den gennemgående røde tråd. Samme
  // klassificering bruges på alle sider via computePrivatFaelles.
  const privatFaelles = computePrivatFaelles(
    accounts,
    graph.perAccount,
    ctx.currentUserId,
    proxyCtx
      ? {
          partnerUserId: proxyCtx.grantorUserId,
          partnerName: proxyCtx.grantorName ?? 'Partner',
        }
      : undefined
  );


  const today = new Date();
  const longDate = formatLongDateDA(today);
  const longDateCapitalised = longDate.charAt(0).toUpperCase() + longDate.slice(1);
  const monthLabel = formatMonthYearDA(yearMonth);
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const greeting = greetingFor(today);
  const personalGreeting = firstName ? `${greeting}, ${firstName}` : greeting;

  // "Næste skridt"-kortet vises når onboarding-checklisten er fuldt færdig,
  // men der stadig er et konkret næste skridt (ingen begivenheder endnu eller
  // en partner der mangler at signe op). Så falder brugeren ikke af kanten
  // når checklisten forsvinder, og kortet skjuler sig selv når der er taget
  // fat på det.
  const onboardingComplete =
    onboardingProgress.hasIncome &&
    onboardingProgress.hasRecurringExpenses &&
    onboardingProgress.hasRecurringTransfers &&
    onboardingProgress.hasBufferAccount;
  const showNextSteps =
    onboardingComplete &&
    (lifeEvents.length === 0 || ctx.pendingMembers.length > 0);

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

      {showNextSteps && (
        <NextStepsCard
          hasEvents={lifeEvents.length > 0}
          pendingMemberNames={ctx.pendingMembers.map((m) => m.name)}
        />
      )}

      <FamilyStatus members={otherMembersStatus} />

      <IncomeForecastBanner />

      {/* Tier 1 - det brugeren skal se lynhurtigt:
          1. Din måned: Privat + Fælles klart adskilt (den røde tråd)
          2. Cashflow-tjek (advarsler - kompakt, fuld bredde)
          3. To-kolonne: Næste 7 dage + Udgifter pr. gruppe */}
      <PrivatFaellesOverview summary={privatFaelles} monthLabel={monthCap} />

      <div className="mt-8">
        <CashflowWarnings
          fixes={fixes}
          objectiveDeficits={objectiveDeficits}
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

      {/* Måned-mod-måned-trend for variabelt forbrug. Spiir-style at-a-glance
          "udgiver du mere end normalt?". Faste regninger udelades så vi kun
          ser det der reelt VARIERER fra måned til måned. */}
      <div className="mt-8">
        <MonthlyTrendWidget points={monthlyTrend} />
      </div>

      {/* Begivenheder-widget: 1-3 nærmeste planlagte/aktive begivenheder
          med deadline, månedlig opsparingsrate og agent-alerts. Empty
          state pumper mod /begivenheder/ny så feature'en bliver opdaget
          af nye brugere uden at de skal kende sidebaren. */}
      <div className="mt-8">
        <LifeEventsWidget events={lifeEvents} />
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
