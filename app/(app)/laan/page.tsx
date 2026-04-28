import Link from 'next/link';
import { Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { getLoans } from '@/lib/dal';
import {
  formatAmount,
  formatShortDateDA,
  RECURRENCE_LABEL_DA,
  monthlyEquivalent,
  nextOccurrenceAfter,
} from '@/lib/format';
import { deleteLoan } from './actions';
import type { LoanType } from '@/lib/database.types';

const LOAN_TYPE_LABEL_DA: Record<LoanType, string> = {
  realkredit: 'Realkredit',
  banklan: 'Banklån',
  kreditkort: 'Kreditkort',
  kassekredit: 'Kassekredit',
  andet: 'Andet',
};

export default async function LaanPage() {
  const loans = await getLoans();

  // Sum gæld (negative opening_balance values) and monthly burden — gives a
  // single-glance picture of the household's debt situation. payment_amount
  // is per payment_interval, so normalise to /md before summing.
  const totalDebt = loans.reduce(
    (sum, l) => sum + (l.opening_balance < 0 ? -l.opening_balance : 0),
    0
  );
  const monthlyBurden = loans.reduce(
    (sum, l) =>
      sum +
      (l.payment_amount != null
        ? monthlyEquivalent(l.payment_amount, l.payment_interval)
        : 0),
    0
  );

  return (
    <div className="px-8 py-6">
      <header className="flex items-center justify-between border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Lån
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {loans.length === 0
              ? 'Ingen lån endnu'
              : `${loans.length} ${loans.length === 1 ? 'lån' : 'lån'} · ${formatAmount(totalDebt)} kr i samlet gæld · ${formatAmount(monthlyBurden)} kr/md i ydelser`}
          </p>
        </div>
        <Link
          href="/laan/ny"
          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          <Plus className="h-4 w-4" />
          Tilføj lån
        </Link>
      </header>

      {loans.length === 0 ? (
        <div className="mt-8 rounded-md border border-dashed border-neutral-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-neutral-500">
            Ingen lån endnu. Tilføj jeres realkreditlån, banklån, kreditkort
            eller kassekredit her — så har I rente, restgæld og ydelse samlet
            ét sted.
          </p>
          <Link
            href="/laan/ny"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" />
            Tilføj lån
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {loans.map((l) => {
            const debt = l.opening_balance < 0 ? -l.opening_balance : 0;
            const principal = l.original_principal ?? 0;
            const paid = principal > 0 ? Math.max(0, principal - debt) : 0;
            const paidPct = principal > 0 ? Math.round((paid / principal) * 100) : null;
            const isShared = l.owner_name === 'Fælles';
            return (
              <div
                key={l.id}
                className="rounded-md border border-neutral-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-neutral-900">
                        {l.name}
                      </span>
                      {l.loan_type && (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
                          {LOAN_TYPE_LABEL_DA[l.loan_type]}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          isShared
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {isShared ? 'Fælles' : 'Personlig'}
                      </span>
                    </div>
                    {l.lender && (
                      <div className="mt-0.5 text-xs text-neutral-500">{l.lender}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link
                      href={`/laan/${l.id}`}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      <Pencil className="h-3 w-3" />
                      Rediger
                    </Link>
                    <form action={deleteLoan}>
                      <input type="hidden" name="id" value={l.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                        Slet
                      </button>
                    </form>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-neutral-500">Restgæld</dt>
                    <dd className="font-mono tabnum text-sm font-semibold text-neutral-900">
                      {formatAmount(debt)} kr
                    </dd>
                  </div>
                  {l.original_principal != null && (
                    <div>
                      <dt className="text-neutral-500">Hovedstol</dt>
                      <dd className="font-mono tabnum text-sm text-neutral-700">
                        {formatAmount(l.original_principal)} kr
                        {paidPct != null && (
                          <span className="ml-1.5 text-xs text-neutral-500">
                            ({paidPct}% afbetalt)
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  {l.payment_amount != null && l.payment_amount > 0 && (
                    <div>
                      <dt className="text-neutral-500">Ydelse</dt>
                      <dd className="font-mono tabnum text-sm text-neutral-700">
                        {formatAmount(l.payment_amount)} kr
                        <span className="ml-1 text-xs text-neutral-500">
                          / {RECURRENCE_LABEL_DA[l.payment_interval]}
                        </span>
                      </dd>
                    </div>
                  )}
                  {l.payment_start_date && (
                    <div>
                      <dt className="text-neutral-500">Næste betaling</dt>
                      <dd className="inline-flex items-center gap-1 text-sm text-neutral-700">
                        <Calendar className="h-3 w-3 text-neutral-400" />
                        {formatShortDateDA(
                          nextOccurrenceAfter(l.payment_start_date, l.payment_interval)
                        )}
                      </dd>
                    </div>
                  )}
                  {l.term_months != null && (
                    <div>
                      <dt className="text-neutral-500">Løbetid</dt>
                      <dd className="text-sm text-neutral-700">
                        {l.term_months} mdr
                        {l.term_months >= 12 && (
                          <span className="ml-1 text-xs text-neutral-500">
                            ({Math.round((l.term_months / 12) * 10) / 10} år)
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  {l.interest_rate != null && (
                    <div>
                      <dt className="text-neutral-500">Rente</dt>
                      <dd className="font-mono tabnum text-sm text-neutral-700">
                        {l.interest_rate}%
                      </dd>
                    </div>
                  )}
                  {l.apr != null && (
                    <div>
                      <dt className="text-neutral-500">ÅOP</dt>
                      <dd className="font-mono tabnum text-sm text-neutral-700">
                        {l.apr}%
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
