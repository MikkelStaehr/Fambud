import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { getDashboardData, hasAnyRecurringExpenses } from '@/lib/dal';
import {
  ACCOUNT_KIND_LABEL_DA,
  formatAmount,
  formatLongDateDA,
  formatMonthYearDA,
} from '@/lib/format';

export default async function DashboardPage() {
  const [{ accounts, monthlyTotals, yearMonth }, hasRecurringExpenses] = await Promise.all([
    getDashboardData(),
    hasAnyRecurringExpenses(),
  ]);

  const today = new Date();
  const longDate = formatLongDateDA(today);
  // Capitalise first letter — Intl returns lowercase weekday names.
  const longDateCapitalised = longDate.charAt(0).toUpperCase() + longDate.slice(1);
  const monthLabel = formatMonthYearDA(yearMonth);
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const { income, expense, net } = monthlyTotals;
  // Use a real minus sign for negative amounts so the figures align visually
  // when paired with the green '+' for positives.
  const netSign = net >= 0 ? '+' : '−';
  const netClass =
    net > 0
      ? 'text-green-700'
      : net < 0
        ? 'text-red-700'
        : 'text-neutral-900';

  return (
    <div className="px-8 py-6">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-neutral-700">{longDateCapitalised}</p>
      </header>

      {/* CTA: only shown until the user has any recurring transactions. After
          that, the Budget link in the sidebar is the discovery surface. */}
      {!hasRecurringExpenses && (
        <div className="mt-6 flex items-start gap-4 rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
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
            className="shrink-0 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Sæt budget op
          </Link>
        </div>
      )}

      {/* Cashflow summaries — denne måned + forecast placeholder */}
      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
            {monthCap}
          </h2>
          <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            <div className="grid grid-cols-3 divide-x divide-neutral-100">
              <div className="px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  Indtægter
                </div>
                <div className="tabnum mt-1 font-mono text-base text-green-700">
                  + {formatAmount(income)}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  Udgifter
                </div>
                <div className="tabnum mt-1 font-mono text-base text-red-700">
                  − {formatAmount(expense)}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  Netto
                </div>
                <div className={`tabnum mt-1 font-mono text-base font-semibold ${netClass}`}>
                  {netSign} {formatAmount(Math.abs(net))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Næste 30 dages cashflow
          </h2>
          <div className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-12 text-center">
            <div className="text-sm text-neutral-500">Forecast kommer snart</div>
          </div>
        </div>
      </section>

      {/* Konti — bare en oversigt over hvilke konti husstanden har, uden saldo. */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Konti
          </h2>
          <span className="text-xs text-neutral-400">
            {accounts.length} {accounts.length === 1 ? 'konto' : 'konti'}
          </span>
        </div>

        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          {accounts.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-neutral-500">
              Ingen konti endnu — opret en under{' '}
              <span className="text-neutral-700">Konti</span>.
            </div>
          ) : (
            <table className="w-full">
              <tbody>
                {accounts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-neutral-100 last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-neutral-900">{a.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                        <span>{ACCOUNT_KIND_LABEL_DA[a.kind] ?? a.kind}</span>
                        {a.owner_name && (
                          <>
                            <span className="text-neutral-300">·</span>
                            <span>{a.owner_name}</span>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
