// /poster - overblik over faktiske posteringer i en valgt måned. Til
// forskel fra /budget der viser theoretical kr/md (monthlyEquivalent),
// viser denne side hvad der faktisk er bogført - så fx en årlig forsikring
// står med fuld pris i den måned den falder, ikke 1/12.
//
// Hierarkisk tabel grupperet på kategori-grupper med Fælles/Private-tab.
// Indkomst rulles op i en lille summary-card række øverst (sammen med
// udgifter og netto), og udgifter går i selve tabellen.

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getTransactionsForMonth, shouldShowTour } from '@/lib/dal';
import { PosterTour } from './_components/PosterTour';
import {
  CATEGORY_GROUP_COLOR,
  categoryGroupFor,
} from '@/lib/categories';
import {
  currentYearMonth,
  formatAmount,
  formatMonthYearDA,
} from '@/lib/format';
import { MonthFilter } from '../_components/MonthFilter';
import { PosterTable, type PosterRow } from './_components/PosterTable';

// Sanity-check the month parameter so a malformed URL doesn't blow up the
// SQL query - fall back to the current month silently.
function normaliseYearMonth(raw: string | undefined): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw;
  return currentYearMonth();
}

export default async function PosterPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = normaliseYearMonth(sp.month);
  const [transactions, autoStartTour] = await Promise.all([
    getTransactionsForMonth(month),
    shouldShowTour('poster'),
  ]);

  // Månedssammendrag på tværs af både indkomst og udgifter.
  const totals = transactions.reduce(
    (acc, t) => {
      if (t.category?.kind === 'income') acc.income += t.amount;
      else if (t.category?.kind === 'expense') acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );
  const net = totals.income - totals.expense;

  // Tabel-rækker - kun udgifts-poster (indkomst hører til /indkomst og er
  // sammenfattet i kortene øverst). Hver række inkluderer den joined konto-
  // og kategori-info så client-komponenten kan filtrere/gruppere uden
  // ekstra queries.
  const rows: PosterRow[] = transactions
    .filter((t) => t.category?.kind === 'expense')
    .map<PosterRow>((t) => {
      const group = categoryGroupFor(t.category?.name ?? '');
      return {
        id: t.id,
        description: t.description ?? t.category?.name ?? 'Uden beskrivelse',
        group,
        groupColor: CATEGORY_GROUP_COLOR[group],
        categoryName: t.category?.name ?? '–',
        categoryColor: t.category?.color ?? '#94a3b8',
        occursOn: t.occurs_on,
        recurrence: t.recurrence,
        accountId: t.account?.id ?? '',
        accountName: t.account?.name ?? '–',
        isShared: t.account?.owner_name === 'Fælles',
        amount: t.amount,
      };
    });

  const monthLabel = formatMonthYearDA(month);
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <PosterTour autoStart={autoStartTour} />
      <header className="flex flex-col gap-3 border-b border-neutral-200 pb-6 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            Poster
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            {monthCap} · {transactions.length}{' '}
            {transactions.length === 1 ? 'post' : 'poster'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthFilter yearMonth={month} basePath="/poster" />
          <Link
            href="/poster/ny"
            data-tour="poster-add"
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Ny post
          </Link>
        </div>
      </header>

      {/* Månedssammendrag - indtægter, udgifter, netto */}
      <section className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-md border border-neutral-200 bg-white px-3 py-3 sm:px-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 sm:text-xs">
            Indtægter
          </div>
          <div className="tabnum mt-1 font-mono text-sm font-semibold text-emerald-800 sm:text-lg">
            + {formatAmount(totals.income)}
          </div>
        </div>
        <div className="rounded-md border border-neutral-200 bg-white px-3 py-3 sm:px-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 sm:text-xs">
            Udgifter
          </div>
          <div className="tabnum mt-1 font-mono text-sm font-semibold text-red-900 sm:text-lg">
            − {formatAmount(totals.expense)}
          </div>
        </div>
        <div className="rounded-md border border-neutral-200 bg-white px-3 py-3 sm:px-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 sm:text-xs">
            Netto
          </div>
          <div
            className={`tabnum mt-1 font-mono text-sm font-semibold sm:text-lg ${
              net > 0 ? 'text-emerald-800' : net < 0 ? 'text-red-900' : 'text-neutral-900'
            }`}
          >
            {net >= 0 ? '+ ' : '− '}
            {formatAmount(Math.abs(net))}
          </div>
        </div>
      </section>

      {/* Hierarkisk udgifts-tabel med Fælles/Private-tab */}
      <section data-tour="poster-filters" className="mt-8">
        <PosterTable rows={rows} />
      </section>
    </div>
  );
}
