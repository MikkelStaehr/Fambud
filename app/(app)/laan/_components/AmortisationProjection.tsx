// Renders an amortisation projection for an annuitetslån: how rente, afdrag
// and restgæld evolve over the lifetime of the loan, and the year where
// afdrag overtakes rente. Returns null if the loan lacks the inputs needed
// (negative balance + payment_rente + payment_afdrag).

import {
  projectAmortisation,
  pickMilestones,
} from '@/lib/loan-projection';
import { formatAmount, RECURRENCE_LABEL_DA } from '@/lib/format';
import type { Account } from '@/lib/database.types';

type Props = {
  loan: Pick<
    Account,
    | 'opening_balance'
    | 'payment_interval'
    | 'payment_rente'
    | 'payment_afdrag'
    | 'payment_bidrag'
    | 'payment_rabat'
  >;
};

export function AmortisationProjection({ loan }: Props) {
  // Need a non-zero debt and at least rente + afdrag to project anything.
  // opening_balance is stored negative for debt - convert to positive principal.
  const remainingPrincipal =
    loan.opening_balance < 0 ? -loan.opening_balance : 0;
  if (
    remainingPrincipal === 0 ||
    loan.payment_rente == null ||
    loan.payment_rente <= 0 ||
    loan.payment_afdrag == null ||
    loan.payment_afdrag <= 0
  ) {
    return null;
  }

  const result = projectAmortisation({
    remainingPrincipal,
    rentePerPeriod: loan.payment_rente,
    afdragPerPeriod: loan.payment_afdrag,
    bidragPerPeriod: loan.payment_bidrag ?? 0,
    rabatPerPeriod: loan.payment_rabat ?? 0,
    paymentInterval: loan.payment_interval,
  });

  return (
    <section className="mt-10 rounded-md border border-neutral-200 bg-white p-4">
      <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Amortisering
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        Antaget annuitetslån: total ydelse pr. {RECURRENCE_LABEL_DA[loan.payment_interval]}{' '}
        holdes konstant. Rente og bidrag falder, afdrag vokser i takt med at
        gælden betales af. F1/F3-rentejusteringer indregnes ikke.
      </p>

      {!result.ok ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {result.reason}
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-xs text-neutral-500">Total rente over løbetiden</div>
              <div className="mt-0.5 font-mono tabnum text-base font-semibold text-neutral-900">
                {formatAmount(result.totalRente)} kr
              </div>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-xs text-neutral-500">Lånet er betalt om</div>
              <div className="mt-0.5 font-mono tabnum text-base font-semibold text-neutral-900">
                {result.payoffYears < 1
                  ? `${Math.round(result.payoffYears * 12)} mdr`
                  : `~${result.payoffYears.toFixed(1)} år`}
              </div>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-xs text-neutral-500">Afdrag &gt; rente fra</div>
              <div className="mt-0.5 font-mono tabnum text-base font-semibold text-neutral-900">
                {result.crossoverYear === null
                  ? 'allerede nu'
                  : result.crossoverYear < 1
                    ? `~${Math.round(result.crossoverYear * 12)} mdr`
                    : `~${result.crossoverYear.toFixed(1)} år`}
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                  <th className="py-2 pr-3">Tidspunkt</th>
                  <th className="py-2 pr-3 text-right">Rente</th>
                  <th className="py-2 pr-3 text-right">Afdrag</th>
                  <th className="py-2 pr-3 text-right">Bidrag</th>
                  <th className="py-2 pr-3 text-right">Restgæld</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-neutral-100">
                  <td className="py-2 pr-3 text-neutral-700">Nu</td>
                  <td className="py-2 pr-3 text-right font-mono tabnum text-neutral-700">
                    {formatAmount(loan.payment_rente!)} kr
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabnum text-neutral-700">
                    {formatAmount(loan.payment_afdrag!)} kr
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabnum text-neutral-700">
                    {formatAmount(loan.payment_bidrag ?? 0)} kr
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabnum font-semibold text-neutral-900">
                    {formatAmount(remainingPrincipal)} kr
                  </td>
                </tr>
                {pickMilestones(result.periods).map((p, i, arr) => {
                  const isLast = i === arr.length - 1 && p.remaining === 0;
                  return (
                    <tr key={p.periodIndex} className="border-b border-neutral-100">
                      <td className="py-2 pr-3 text-neutral-700">
                        {isLast
                          ? `Slut (~${p.yearAfter.toFixed(1)} år)`
                          : `Om ${p.yearAfter < 1 ? `${Math.round(p.yearAfter * 12)} mdr` : `${Math.round(p.yearAfter)} år`}`}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabnum text-neutral-700">
                        {formatAmount(p.rente)} kr
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabnum text-neutral-700">
                        {formatAmount(p.afdrag)} kr
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabnum text-neutral-700">
                        {formatAmount(p.bidrag)} kr
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabnum font-semibold text-neutral-900">
                        {formatAmount(p.remaining)} kr
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
