// /loensedler - observationssiden.
//
// Viser kun den indloggede brugers egne lønsedler (privatøkonomi). I et
// par-husstand ser hver person sin egen liste; partneren er ikke synlig
// her.
//
// I PR 6 er det rene listevisning. PR 7 vil tilføje:
// - Feriesaldo-graf over tid
// - Sammenligning mellem måneder (afvigelses-flag)
// - Dashboard-prompt der minder brugeren om at registrere månedens lønseddel
//   (kun for brugere der har aktiveret agent-funktionen)

import Link from 'next/link';
import { Calendar, Pencil, Plus } from 'lucide-react';
import { getMyPayslips } from '@/lib/dal';
import {
  formatAmount,
  formatPayslipBalance,
  formatShortDateDA,
  payslipGrossAmount,
  payslipNetAmount,
} from '@/lib/format';

export default async function LoensedlerPage() {
  const payslips = await getMyPayslips();

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Lønsedler
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {payslips.length === 0
              ? 'Ingen lønsedler registreret endnu'
              : `${payslips.length} ${payslips.length === 1 ? 'lønseddel' : 'lønsedler'}`}
          </p>
        </div>
        <Link
          href="/loensedler/ny"
          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Registrer lønseddel
        </Link>
      </header>

      {payslips.length === 0 ? (
        <div className="mt-8 rounded-md border border-dashed border-neutral-200 bg-white px-6 py-12 text-center">
          <p className="mx-auto max-w-md text-sm text-neutral-500">
            Når du registrerer dine lønsedler her, kan vi over tid hjælpe
            dig med at forstå hvad der står på dem - feriesaldo,
            overarbejde, afvigelser fra normalen - og over tid bygge et
            billede af din løn-udvikling.
          </p>
          <Link
            href="/loensedler/ny"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Registrer din første
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {payslips.map((payslip) => {
            const gross = payslipGrossAmount(payslip.lines);
            const net = payslipNetAmount(payslip.lines);
            return (
              <div
                key={payslip.id}
                className="rounded-md border border-neutral-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-900">
                        <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                        {formatShortDateDA(payslip.period_start)} -{' '}
                        {formatShortDateDA(payslip.period_end)}
                      </span>
                      {payslip.employer && (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
                          {payslip.employer}
                        </span>
                      )}
                    </div>
                    {payslip.pay_date && (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Udbetalt {formatShortDateDA(payslip.pay_date)}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/loensedler/${payslip.id}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <Pencil className="h-3 w-3" />
                    Åbn
                  </Link>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-neutral-500">Bruttoløn</dt>
                    <dd className="font-mono tabnum text-sm font-semibold text-neutral-900">
                      {formatAmount(gross)} kr
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Udbetalt</dt>
                    <dd className="font-mono tabnum text-sm font-semibold text-emerald-700">
                      {formatAmount(net)} kr
                    </dd>
                  </div>
                  {payslip.feriesaldo_remaining != null && (
                    <div>
                      <dt className="text-neutral-500">Feriedage</dt>
                      <dd className="font-mono tabnum text-sm text-neutral-700">
                        {formatPayslipBalance(payslip.feriesaldo_remaining, 'dage')}
                      </dd>
                    </div>
                  )}
                  {payslip.overarbejde_remaining != null && (
                    <div>
                      <dt className="text-neutral-500">Overarbejde</dt>
                      <dd className="font-mono tabnum text-sm text-neutral-700">
                        {formatPayslipBalance(payslip.overarbejde_remaining, 'timer')}
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
