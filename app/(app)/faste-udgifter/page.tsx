import Link from 'next/link';
import {
  ArrowRight,
  Plus,
  ClipboardList,
} from 'lucide-react';
import {
  ensureStandardExpenseCategories,
  getBudgetAccounts,
  getRecurringExpensesForAccount,
} from '@/lib/dal';
import {
  ACCOUNT_KIND_LABEL_DA,
  effectiveAmount,
  formatAmount,
  monthlyEquivalent,
} from '@/lib/format';

// Per-account stats shown on the overview cards.
type AccountStat = {
  id: string;
  name: string;
  kind: string;
  ownerLabel: string;
  isShared: boolean;
  expenseCount: number;
  monthly: number;
  yearly: number;
};

export default async function BudgetOverviewPage() {
  // Same idempotent seed the per-account page does, so first-time landings
  // here also have the standard categories ready.
  await ensureStandardExpenseCategories();

  const accounts = await getBudgetAccounts();

  // Pull recurring expenses for each account in parallel and roll up to a
  // single monthly figure per account. The /faste-udgifter/[id] page does
  // this same calculation; we mirror it so totals match exactly.
  const stats: AccountStat[] = await Promise.all(
    accounts.map(async (a) => {
      const expenses = await getRecurringExpensesForAccount(a.id);
      const monthly = expenses.reduce(
        (sum, e) =>
          sum +
          monthlyEquivalent(
            effectiveAmount(e.amount, e.components, e.components_mode),
            e.recurrence
          ),
        0
      );
      return {
        id: a.id,
        name: a.name,
        kind: ACCOUNT_KIND_LABEL_DA[a.kind] ?? a.kind,
        ownerLabel: a.owner_name ?? 'Personlig',
        isShared: a.owner_name === 'Fælles',
        expenseCount: expenses.length,
        monthly,
        yearly: monthly * 12,
      };
    })
  );

  const householdMonthly = stats.reduce((sum, s) => sum + s.monthly, 0);

  if (accounts.length === 0) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-neutral-200 pb-6">
          <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Faste udgifter
          </h1>
        </header>
        <div className="mt-8 max-w-xl rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Du har ingen budget-relevante konti endnu. Opret en{' '}
          <span className="font-medium">Budgetkonto</span> via{' '}
          <Link href="/konti/ny" className="underline">
            Konti
          </Link>{' '}
          først.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-200 pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Faste udgifter
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {accounts.length} {accounts.length === 1 ? 'konto' : 'konti'} ·{' '}
              <span className="font-mono tabnum font-medium text-neutral-900">
                {formatAmount(householdMonthly)} kr/md
              </span>{' '}
              i faste udgifter
            </p>
          </div>
          <Link
            href="/konti/ny"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <Plus className="h-4 w-4" />
            Ny konto
          </Link>
        </div>
      </header>

      <section className="mt-8">
        <p className="mb-3 max-w-2xl text-xs text-neutral-500">
          Konti hvor faste regninger trækkes. Klik for at se og redigere
          udgifterne pr. konto.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => (
            <Link
              key={s.id}
              href={`/faste-udgifter/${s.id}`}
              className="group rounded-md border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 shrink-0 text-neutral-400" />
                    <span className="truncate text-sm font-semibold text-neutral-900">
                      {s.name}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-neutral-500">{s.kind}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        s.isShared
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {s.ownerLabel}
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300 transition group-hover:text-neutral-700" />
              </div>

              <div className="mt-4 flex items-end justify-between border-t border-neutral-100 pt-3">
                <div>
                  <div className="text-xs text-neutral-500">
                    {s.expenseCount === 0
                      ? 'Ingen udgifter endnu'
                      : `${s.expenseCount} ${s.expenseCount === 1 ? 'udgift' : 'udgifter'}`}
                  </div>
                  <div className="mt-0.5 font-mono tabnum text-base font-semibold text-neutral-900">
                    {formatAmount(s.monthly)} kr/md
                  </div>
                  {s.monthly > 0 && (
                    <div className="font-mono tabnum text-xs text-neutral-500">
                      {formatAmount(s.yearly)} kr/år
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
