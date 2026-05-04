// /budget - flad tabel-overblik over alle faste udgifter på tværs af konti.
// Kolonner: Gruppe / Navn / Interval / Konto / Beløb. Filter-bar i toppen
// (søg + dropdowns for konto/gruppe/interval) gør det nemt at skære data ned.
//
// Forskellen til /faste-udgifter (værktøjet): denne side er kun til at se
// - alle CRUD-handlinger sker via /faste-udgifter/[accountId]. Hver række
// linker dertil for redigering. Det matcher sidebar-strukturen
// (Budget = overblik; Faste udgifter = værktøj under Værktøjer-gruppen).

import Link from 'next/link';
import { Plus } from 'lucide-react';
import {
  getBudgetAccounts,
  getRecurringExpensesForAccount,
} from '@/lib/dal';
import {
  CATEGORY_GROUP_COLOR,
  categoryGroupFor,
} from '@/lib/categories';
import {
  effectiveAmount,
  formatAmount,
  monthlyEquivalent,
} from '@/lib/format';
import { BudgetTable, type BudgetRow } from './_components/BudgetTable';

export default async function BudgetOverviewPage() {
  const accounts = await getBudgetAccounts();

  // Hent udgifter pr. konto parallelt og flatten til én liste hvor hver række
  // indeholder den joined konto-info. Det er samme læse-mønster som
  // /faste-udgifter (oversigten), bare uden aggregat-rollups.
  const perAccount = await Promise.all(
    accounts.map(async (a) => ({
      account: a,
      expenses: await getRecurringExpensesForAccount(a.id),
    }))
  );

  const rows: BudgetRow[] = perAccount.flatMap(({ account, expenses }) =>
    expenses.map<BudgetRow>((e) => {
      const eff = effectiveAmount(e.amount, e.components, e.components_mode);
      const monthly = monthlyEquivalent(eff, e.recurrence);
      const group = categoryGroupFor(e.category?.name ?? '');
      return {
        id: e.id,
        description: e.description ?? e.category?.name ?? 'Udgift',
        group,
        groupColor: CATEGORY_GROUP_COLOR[group],
        categoryName: e.category?.name ?? '–',
        categoryColor: e.category?.color ?? '#94a3b8',
        recurrence: e.recurrence,
        accountId: account.id,
        accountName: account.name,
        isShared: account.owner_name === 'Fælles',
        effective: eff,
        monthly,
      };
    })
  );

  const totalMonthly = rows.reduce((s, r) => s + r.monthly, 0);

  if (accounts.length === 0) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-neutral-200 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            Budget
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Overblik over alle faste udgifter.
          </p>
        </header>
        <div className="mt-8 max-w-xl rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Du har ingen budget-relevante konti endnu. Opret en{' '}
          <Link href="/konti/ny" className="underline">
            Budgetkonto
          </Link>{' '}
          først, og tilføj derefter dine faste udgifter under{' '}
          <Link href="/faste-udgifter" className="underline">
            Faste udgifter
          </Link>
          .
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-200 pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              Budget
            </h1>
            <p className="mt-1.5 text-sm text-neutral-500">
              {rows.length} {rows.length === 1 ? 'fast udgift' : 'faste udgifter'} ·{' '}
              <span className="tabnum font-mono font-medium text-neutral-900">
                {formatAmount(totalMonthly)} kr/md
              </span>{' '}
              i alt
            </p>
          </div>
          <Link
            href="/faste-udgifter"
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Tilføj udgift
          </Link>
        </div>
      </header>

      <section className="mt-6">
        <BudgetTable rows={rows} />
      </section>
    </div>
  );
}
