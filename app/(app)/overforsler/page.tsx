import Link from 'next/link';
import { Plus, Pencil, Trash2, ArrowRight, Repeat } from 'lucide-react';
import { getTransfersForMonth } from '@/lib/dal';
import {
  RECURRENCE_LABEL_DA,
  currentYearMonth,
  formatAmount,
  formatShortDateDA,
} from '@/lib/format';
import { MonthFilter } from '../_components/MonthFilter';
import { deleteTransfer } from './actions';

function normaliseYearMonth(raw: string | undefined): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw;
  return currentYearMonth();
}

export default async function OverforslerPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = normaliseYearMonth(sp.month);
  const transfers = await getTransfersForMonth(month);

  return (
    <div className="px-8 py-6">
      <header className="flex items-center justify-between border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Overførsler
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {transfers.length} {transfers.length === 1 ? 'overførsel' : 'overførsler'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthFilter yearMonth={month} basePath="/overforsler" />
          <Link
            href="/overforsler/ny"
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" />
            Ny overførsel
          </Link>
        </div>
      </header>

      <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
        {transfers.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-neutral-500">
            Ingen overførsler i denne måned.
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-b border-neutral-100 last:border-b-0">
                  <td className="w-24 whitespace-nowrap px-4 py-3 text-xs text-neutral-500">
                    {formatShortDateDA(t.occurs_on)}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2 text-sm text-neutral-900">
                      <span className="font-medium">{t.from_account?.name ?? '—'}</span>
                      <ArrowRight className="h-3 w-3 text-neutral-400" />
                      <span className="font-medium">{t.to_account?.name ?? '—'}</span>
                      {t.recurrence !== 'once' && (
                        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">
                          <Repeat className="h-2.5 w-2.5" />
                          {RECURRENCE_LABEL_DA[t.recurrence]}
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <div className="mt-0.5 text-xs text-neutral-500">{t.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabnum font-mono text-sm text-neutral-900">
                      {formatAmount(t.amount)}
                    </span>
                  </td>
                  <td className="w-px whitespace-nowrap px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/overforsler/${t.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                      >
                        <Pencil className="h-3 w-3" />
                        Rediger
                      </Link>
                      <form action={deleteTransfer}>
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
