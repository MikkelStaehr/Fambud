import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { getDashboardData, hasAnyRecurringExpenses } from '@/lib/dal';
import {
  formatAmount,
  formatLongDateDA,
  formatMonthYearDA,
} from '@/lib/format';
import { CashflowAdvisor } from './_components/CashflowAdvisor';
import { MonthlyCategoryChart } from './_components/MonthlyCategoryChart';
import { TopExpensesList } from './_components/TopExpensesList';

export default async function DashboardPage() {
  const [{ monthlyTotals, yearMonth }, hasRecurringExpenses] = await Promise.all([
    getDashboardData(),
    hasAnyRecurringExpenses(),
  ]);

  const today = new Date();
  const longDate = formatLongDateDA(today);
  const longDateCapitalised = longDate.charAt(0).toUpperCase() + longDate.slice(1);
  const monthLabel = formatMonthYearDA(yearMonth);
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const { income, expense, net } = monthlyTotals;
  const netSign = net >= 0 ? '+' : '−';
  const netClass =
    net > 0
      ? 'text-emerald-700'
      : net < 0
        ? 'text-red-700'
        : 'text-neutral-900';

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-neutral-700">{longDateCapitalised}</p>
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
              Sæt dine faste udgifter op
            </div>
            <p className="mt-0.5 text-sm text-amber-800">
              Lige nu er der ingen faste udgifter registreret, så cashflowet er
              tomt. Gå igennem dine konti og fortæl hvad der bliver trukket.
            </p>
          </div>
          <Link
            href="/budget"
            className="shrink-0 self-start rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Sæt budget op
          </Link>
        </div>
      )}

      {/* Måneds-overblik øverst — denne måneds tal til venstre, kategori-
          fordelingen til højre. Erstatter den tidligere "Forecast"-placeholder
          med et chart der faktisk siger noget om hvor pengene går hen. */}
      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
            {monthCap}
          </h2>
          <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            <div className="grid grid-cols-3 divide-x divide-neutral-100">
              <div className="px-3 py-3 sm:px-4">
                <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 sm:text-xs">
                  Indtægter
                </div>
                <div className="tabnum mt-1 font-mono text-sm text-emerald-700 sm:text-base">
                  + {formatAmount(income)}
                </div>
              </div>
              <div className="px-3 py-3 sm:px-4">
                <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 sm:text-xs">
                  Udgifter
                </div>
                <div className="tabnum mt-1 font-mono text-sm text-red-700 sm:text-base">
                  − {formatAmount(expense)}
                </div>
              </div>
              <div className="px-3 py-3 sm:px-4">
                <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 sm:text-xs">
                  Netto
                </div>
                <div className={`tabnum mt-1 font-mono text-sm font-semibold sm:text-base ${netClass}`}>
                  {netSign} {formatAmount(Math.abs(net))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <TopExpensesList limit={5} />
          </div>
        </div>

        <MonthlyCategoryChart limit={8} />
      </section>

      <CashflowAdvisor />
    </div>
  );
}
