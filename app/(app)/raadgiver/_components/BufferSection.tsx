// Buffer-sektion på rådgiveren. Flow-orienteret (appen har ingen saldo):
// vi viser målbeløbet (3 mdr. faste udgifter), hvad I indskyder nu, hvor
// lang tid det tager ved den rate, og en anbefalet rate for at nå målet på
// et år. Server-renderet - ingen interaktiv tilstand endnu.

import { formatAmount } from '@/lib/format';
import type { BufferPlan } from '@/lib/economy-plan';

function formatDuration(months: number): string {
  if (months < 12) return `${months} mdr.`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return years === 1 ? '1 år' : `${years} år`;
  return `${years} år ${rem} mdr.`;
}

export function BufferSection({
  buffer,
  bufferAccountName,
  monthlyLoanPayments,
  hasLoans,
}: {
  buffer: BufferPlan;
  bufferAccountName: string | null;
  monthlyLoanPayments: number;
  hasLoans: boolean;
}) {
  const {
    coverMonths,
    target,
    monthlyFixedExpenses,
    currentMonthly,
    recommendedMonthly,
    reachInMonths,
    monthsAtCurrentRate,
  } = buffer;

  if (monthlyFixedExpenses === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-6 text-sm text-neutral-500">
        Når I har registreret jeres faste udgifter, kan jeg anbefale en
        passende bufferstørrelse.
      </div>
    );
  }

  const hasContribution = currentMonthly > 0;
  // "På spor" hvis nuværende rate når målet inden for den ønskede horisont.
  const onTrack =
    monthsAtCurrentRate != null && monthsAtCurrentRate <= reachInMonths;

  return (
    <div className="rounded-lg border border-amber-200 bg-white">
      <div className="border-b border-amber-100 bg-amber-50/60 px-4 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Anbefalet buffer ({coverMonths} mdr. faste udgifter)
        </div>
        <div className="tabnum mt-0.5 font-mono text-2xl font-semibold text-neutral-900">
          {formatAmount(target)} kr
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">
          Dækker {coverMonths} måneders faste udgifter à{' '}
          <span className="tabnum font-mono">
            {formatAmount(monthlyFixedExpenses)} kr/md
          </span>{' '}
          ved pludseligt tab af indkomst.
        </p>
      </div>

      <div className="px-4 py-4 text-sm">
        {hasContribution ? (
          <p className="text-neutral-700">
            I indskyder{' '}
            <span className="tabnum font-mono font-semibold">
              {formatAmount(currentMonthly)} kr/md
            </span>
            {bufferAccountName ? ` i ${bufferAccountName}` : ' i bufferen'}. Ved
            den rate når I målet om{' '}
            <span
              className={`font-semibold ${onTrack ? 'text-emerald-800' : 'text-amber-800'}`}
            >
              {monthsAtCurrentRate != null
                ? formatDuration(monthsAtCurrentRate)
                : 'aldrig'}
            </span>
            .
          </p>
        ) : (
          <p className="text-amber-800">
            I har ikke sat en fast buffer-overførsel op endnu.
          </p>
        )}

        {onTrack ? (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-xs text-emerald-900">
            <span className="font-medium">I er på sporet.</span> Fortsæt med det
            nuværende indskud, så er bufferen fuld inden for et år.
          </div>
        ) : hasLoans ? (
          <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs leading-relaxed text-neutral-700">
            <span className="font-medium text-neutral-900">
              Realistisk vej derhen:
            </span>{' '}
            I betaler{' '}
            <span className="tabnum font-mono">
              {formatAmount(monthlyLoanPayments)} kr/md
            </span>{' '}
            af på lån. Efterhånden som de afvikles, frigøres de penge - flyt dem
            over i bufferen i stedet for at skære i forbruget nu. At nå hele
            målet på {formatDuration(reachInMonths)} ville ellers kræve ca.{' '}
            <span className="tabnum font-mono">
              {formatAmount(recommendedMonthly)} kr/md
            </span>
            .
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs leading-relaxed text-neutral-700">
            <span className="font-medium text-neutral-900">Forslag:</span> start
            med et fast beløb I kan holde - selv en mindre rate bygger bufferen
            op over tid. At nå hele målet på {formatDuration(reachInMonths)}{' '}
            kræver ca.{' '}
            <span className="tabnum font-mono">
              {formatAmount(recommendedMonthly)} kr/md
            </span>
            .
          </div>
        )}
      </div>
    </div>
  );
}
