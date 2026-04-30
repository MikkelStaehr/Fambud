import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import {
  getAccounts,
  getAdvisorContext,
  getCashflowGraph,
  getCurrentMemberFirstName,
  getDashboardData,
  getMonthlyExpensesByGroup,
  getUpcomingEvents,
  hasAnyRecurringExpenses,
} from '@/lib/dal';
import {
  formatLongDateDA,
  formatMonthYearDA,
} from '@/lib/format';
import { buildFixFor, detectCashflowIssues } from '@/lib/cashflow-analysis';
import { CashflowGraph } from './_components/CashflowGraph';
import { CashflowWarnings } from './_components/CashflowWarnings';
import { CategoryGroupChart } from './_components/CategoryGroupChart';
import { HeroStatus } from './_components/HeroStatus';
import { IncomeForecastBanner } from './_components/IncomeForecastBanner';
import { UpcomingEvents } from './_components/UpcomingEvents';

// Tidsbestemt hilsen — dansk, fire buckets der dækker normale vågne timer.
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
  // Alt dashboard-data hentes parallelt. getCashflowGraph() bruges stadig
  // til at finde underskud (CashflowWarnings) — Sankey'en der visualiserede
  // det samme data er fjernet fordi den var kompleks og marginalt nyttig.
  const [
    { monthlyTotals, yearMonth },
    hasRecurringExpenses,
    firstName,
    accounts,
    graph,
    ctx,
    expenseGroups,
    upcomingEvents,
  ] = await Promise.all([
    getDashboardData(),
    hasAnyRecurringExpenses(),
    getCurrentMemberFirstName(),
    getAccounts(),
    getCashflowGraph(),
    getAdvisorContext(),
    getMonthlyExpensesByGroup(),
    getUpcomingEvents(),
  ]);

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

  // Buffer-konto er fundamentet — hvis brugeren har faste udgifter men
  // ingen bufferkonto sat op, advarer vi proaktivt så det er top-of-mind.
  // Vi viser ikke advarslen før brugeren har faste udgifter, da den ellers
  // collide med onboarding-CTAen ("Lad os fylde budgettet op").
  const hasBufferAccount = accounts.some((a) =>
    a.savings_purposes?.includes('buffer')
  );
  const showBufferWarning = hasRecurringExpenses && !hasBufferAccount;

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
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          {personalGreeting}
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">{longDateCapitalised}</p>
      </header>

      {/* CTA: only shown until the user has any recurring transactions. After
          that, the Budget link in the sidebar is the discovery surface. */}
      {!hasRecurringExpenses && (
        <div className="mt-6 flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-start sm:gap-4">
          <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-900">
              Lad os fylde budgettet op
            </div>
            <p className="mt-0.5 text-sm text-amber-800">
              Når du har lagt dine faste udgifter ind, kan vi vise dig hvor pengene
              løber hen — og hvor du sparer mest.
            </p>
          </div>
          <Link
            href="/faste-udgifter"
            className="shrink-0 self-start rounded-md bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-900"
          >
            Kom i gang
          </Link>
        </div>
      )}

      <IncomeForecastBanner />

      {/* Tier 1 — det brugeren skal se lynhurtigt:
          1. HeroStatus: "Er du på rette spor?" (netto + statustekst)
          2. Cashflow-tjek (advarsler — kompakt, fuld bredde)
          3. To-kolonne: Næste 7 dage + Udgifter pr. gruppe */}
      <HeroStatus
        income={income}
        expense={expense}
        net={net}
        monthLabel={monthCap}
      />

      <div className="mt-8">
        <CashflowWarnings
          fixes={fixes}
          pendingMembers={ctx.pendingMembers}
          showBufferWarning={showBufferWarning}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingEvents events={upcomingEvents} />
        <CategoryGroupChart
          privateGroups={expenseGroups.private}
          sharedGroups={expenseGroups.shared}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Pengestrøm
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
