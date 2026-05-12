// /loensedler/[id] - detalje + redigering.
//
// Layout:
//   - Header med periode + arbejdsgiver + back-link
//   - Overblik: bruttoløn, udbetalt, saldoer (read-only stats-card)
//   - PayslipForm til redigering (kan justere alt: periode, linjer,
//     saldoer)
//   - Farezone (slet)

import Link from 'next/link';
import { ArrowLeft, Calendar, Trash2 } from 'lucide-react';
import { getPayslipById, getPayslipLabelMap } from '@/lib/dal';
import {
  formatAmount,
  formatPayslipBalance,
  formatShortDateDA,
  payslipGrossAmount,
  payslipNetAmount,
} from '@/lib/format';
import { PayslipForm } from '../_components/PayslipForm';
import { deletePayslip, updatePayslip } from '../actions';

export default async function PayslipDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [payslip, labelMap] = await Promise.all([
    getPayslipById(id),
    getPayslipLabelMap(),
  ]);

  const updateAction = updatePayslip.bind(null, id);
  const gross = payslipGrossAmount(payslip.lines);
  const net = payslipNetAmount(payslip.lines);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/loensedler"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til lønsedler
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="inline-flex items-center gap-1.5 text-xl font-semibold tracking-tight text-neutral-900">
            <Calendar className="h-4 w-4 text-neutral-400" />
            {formatShortDateDA(payslip.period_start)} -{' '}
            {formatShortDateDA(payslip.period_end)}
          </h1>
          {payslip.employer && (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
              {payslip.employer}
            </span>
          )}
        </div>
        {payslip.pay_date && (
          <p className="mt-1 text-sm text-neutral-500">
            Udbetalt {formatShortDateDA(payslip.pay_date)}
          </p>
        )}
      </header>

      {/* Overblik */}
      <section className="mt-6 rounded-md border border-neutral-200 bg-white p-5">
        <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Overblik
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-neutral-500">Bruttoløn</dt>
            <dd className="mt-0.5 font-mono tabnum text-base font-semibold text-neutral-900">
              {formatAmount(gross)} kr
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Udbetalt</dt>
            <dd className="mt-0.5 font-mono tabnum text-base font-semibold text-emerald-700">
              {formatAmount(net)} kr
            </dd>
          </div>
          {payslip.feriesaldo_remaining != null && (
            <div>
              <dt className="text-xs text-neutral-500">Feriedage tilbage</dt>
              <dd className="mt-0.5 font-mono tabnum text-base font-semibold text-neutral-900">
                {formatPayslipBalance(payslip.feriesaldo_remaining, 'dage')}
              </dd>
            </div>
          )}
          {payslip.overarbejde_remaining != null && (
            <div>
              <dt className="text-xs text-neutral-500">Overarbejde</dt>
              <dd className="mt-0.5 font-mono tabnum text-base font-semibold text-neutral-900">
                {formatPayslipBalance(payslip.overarbejde_remaining, 'timer')}
              </dd>
            </div>
          )}
          {payslip.afspadsering_remaining != null && (
            <div>
              <dt className="text-xs text-neutral-500">Afspadsering</dt>
              <dd className="mt-0.5 font-mono tabnum text-base font-semibold text-neutral-900">
                {formatPayslipBalance(payslip.afspadsering_remaining, 'timer')}
              </dd>
            </div>
          )}
        </dl>
        <p className="mt-3 text-[11px] text-neutral-500">
          {payslip.lines.length}{' '}
          {payslip.lines.length === 1 ? 'linje' : 'linjer'} registreret
        </p>
      </section>

      {/* Edit-form */}
      <section className="mt-8 max-w-3xl">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Rediger
        </h2>
        <PayslipForm
          action={updateAction}
          defaultValues={{
            period_start: payslip.period_start,
            period_end: payslip.period_end,
            pay_date: payslip.pay_date,
            employer: payslip.employer,
            feriesaldo_remaining: payslip.feriesaldo_remaining,
            overarbejde_remaining: payslip.overarbejde_remaining,
            afspadsering_remaining: payslip.afspadsering_remaining,
            notes: payslip.notes,
            lines: payslip.lines,
          }}
          labelMap={labelMap}
          submitLabel="Gem ændringer"
          cancelHref="/loensedler"
          error={error}
        />
      </section>

      {/* Farezone */}
      <section className="mt-10 max-w-2xl border-t border-neutral-200 pt-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-red-700">
          Farezone
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Sletter lønsedlen og alle dens linjer. Du mister sammenlignings-
          historikken for denne periode. Dette kan ikke fortrydes.
        </p>
        <form action={deletePayslip} className="mt-3">
          <input type="hidden" name="id" value={payslip.id} />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Slet lønseddel
          </button>
        </form>
      </section>
    </div>
  );
}
