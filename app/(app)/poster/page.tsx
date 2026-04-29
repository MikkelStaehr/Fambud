import Link from 'next/link';
import { Plus, Pencil, Trash2, Repeat } from 'lucide-react';
import { getTransactionsForMonth } from '@/lib/dal';
import {
  RECURRENCE_LABEL_DA,
  currentYearMonth,
  formatAmount,
  formatShortDateDA,
} from '@/lib/format';
import { MonthFilter } from '../_components/MonthFilter';
import { deleteTransaction } from './actions';
import { EmptyState } from '../_components/EmptyState';

// Sanity-check the month parameter so a malformed URL doesn't blow up the
// SQL query — fall back to the current month silently.
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
  const transactions = await getTransactionsForMonth(month);

  // Monthly summary: sum income and expenses by category kind.
  const totals = transactions.reduce(
    (acc, t) => {
      if (t.category?.kind === 'income') acc.income += t.amount;
      else if (t.category?.kind === 'expense') acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );
  const net = totals.income - totals.expense;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 border-b border-neutral-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">Poster</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {transactions.length} {transactions.length === 1 ? 'post' : 'poster'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthFilter yearMonth={month} basePath="/poster" />
          <Link
            href="/poster/ny"
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" />
            Ny post
          </Link>
        </div>
      </header>

      {/* Månedssammendrag */}
      <section className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-md border border-neutral-200 bg-white px-3 py-3 sm:px-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 sm:text-xs">Indtægter</div>
          <div className="tabnum mt-1 font-mono text-sm text-green-700 sm:text-lg">+ {formatAmount(totals.income)}</div>
        </div>
        <div className="rounded-md border border-neutral-200 bg-white px-3 py-3 sm:px-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 sm:text-xs">Udgifter</div>
          <div className="tabnum mt-1 font-mono text-sm text-red-700 sm:text-lg">− {formatAmount(totals.expense)}</div>
        </div>
        <div className="rounded-md border border-neutral-200 bg-white px-3 py-3 sm:px-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 sm:text-xs">Netto</div>
          <div
            className={`tabnum mt-1 font-mono text-sm sm:text-lg ${net >= 0 ? 'text-neutral-900' : 'text-red-700'}`}
          >
            {net >= 0 ? '+ ' : '− '}
            {formatAmount(Math.abs(net))}
          </div>
        </div>
      </section>

      {/* Posterlisten */}
      {transactions.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            message="Ingen poster i denne måned. Tilføj din første eller skift måned ovenfor."
            cta={{ href: '/poster/ny', label: 'Ny post' }}
          />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
          <table className="w-full">
            <tbody>
              {transactions.map((t) => {
                const isIncome = t.category?.kind === 'income';
                return (
                  <tr key={t.id} className="border-b border-neutral-100 last:border-b-0">
                    <td className="w-24 whitespace-nowrap px-4 py-3 text-xs text-neutral-500">
                      {formatShortDateDA(t.occurs_on)}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2 text-sm text-neutral-900">
                        {t.category && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: t.category.color }}
                            aria-hidden
                          />
                        )}
                        <span className="font-medium">
                          {t.description ?? t.category?.name ?? 'Uden beskrivelse'}
                        </span>
                        {t.recurrence !== 'once' && (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500"
                            title={`Gentages ${RECURRENCE_LABEL_DA[t.recurrence]}`}
                          >
                            <Repeat className="h-2.5 w-2.5" />
                            {RECURRENCE_LABEL_DA[t.recurrence]}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                        <span>{t.account?.name ?? '—'}</span>
                        {t.category && (
                          <>
                            <span className="text-neutral-300">·</span>
                            <span>{t.category.name}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`tabnum font-mono text-sm ${isIncome ? 'text-green-700' : 'text-neutral-900'}`}
                      >
                        {isIncome ? '+ ' : '− '}
                        {formatAmount(t.amount)}
                      </span>
                    </td>
                    <td className="w-px whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/poster/${t.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                        >
                          <Pencil className="h-3 w-3" />
                          Rediger
                        </Link>
                        <form action={deleteTransaction}>
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                            Slet
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
