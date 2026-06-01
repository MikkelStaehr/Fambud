// Låneoptimering: hvilket lån skal ekstra afdrag på først? To velkendte
// strategier:
//   • Avalanche - højeste rente først. Sparer MEST i renter (matematisk
//     optimalt).
//   • Snowball  - mindste restgæld først. Giver en hurtig sejr og momentum.
//
// Vi anbefaler avalanche (mest sparet) men forklarer snowball, og viser den
// håndgribelige effekt af et ekstra afdrag på avalanche-målet.

import { formatAmount } from '@/lib/format';
import { extraPaymentImpact } from '@/lib/economy-plan';

type LoanInfo = {
  id: string;
  name: string;
  balance: number;
  rate: number | null;
  monthlyPayment: number;
};

const ILLUSTRATIVE_EXTRA = 100_000; // 1.000 kr i øre

function formatMonthsSaved(months: number): string {
  if (months < 12) return `${months} mdr.`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const yLabel = years === 1 ? '1 år' : `${years} år`;
  return rem === 0 ? yLabel : `${yLabel} ${rem} mdr.`;
}

export function LaaneoptimeringSection({ loans }: { loans: LoanInfo[] }) {
  if (loans.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-white px-4 py-4 text-sm text-emerald-800">
        I har ingen lån registreret - et stærkt udgangspunkt. Så kan overskuddet
        gå direkte til buffer og opsparing.
      </div>
    );
  }

  const withRate = loans.filter((l) => l.rate != null);
  const avalanche =
    withRate.length > 0
      ? [...withRate].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0]
      : null;
  const snowball = [...loans].sort((a, b) => a.balance - b.balance)[0];
  const sorted = [...loans].sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

  const target = avalanche ?? snowball;
  const impact = extraPaymentImpact({
    balance: target.balance,
    annualRatePct: target.rate ?? 0,
    monthlyPayment: target.monthlyPayment,
    extraMonthly: ILLUSTRATIVE_EXTRA,
  });

  const multiple = loans.length > 1;
  // Snowball er kun en separat pointe hvis den peger på et ANDET lån end
  // avalanche (ellers er der ingen modsætning at forklare).
  const snowballDiffers = avalanche != null && snowball.id !== avalanche.id;

  return (
    <div className="space-y-3">
      {/* Mobil: kort-liste der staker tallene under navnet, ingen vandret
          scroll. Desktop (sm+): klassisk tabel sorteret efter rente. */}
      <div className="rounded-lg border border-amber-200 bg-white">
        <ul className="divide-y divide-amber-100 sm:hidden">
          {sorted.map((l) => (
            <li key={l.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-neutral-900">{l.name}</span>
                {avalanche && l.id === avalanche.id && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    dyreste
                  </span>
                )}
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                <div>
                  <dt className="text-neutral-500">Restgæld</dt>
                  <dd className="tabnum mt-0.5 font-mono font-semibold text-neutral-900">
                    {formatAmount(l.balance)}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Rente</dt>
                  <dd className="tabnum mt-0.5 font-mono text-neutral-700">
                    {l.rate != null ? `${l.rate}%` : '–'}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Ydelse/md</dt>
                  <dd className="tabnum mt-0.5 font-mono text-neutral-600">
                    {l.monthlyPayment > 0 ? formatAmount(l.monthlyPayment) : '–'}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        <table className="hidden w-full text-sm sm:table">
          <thead>
            <tr className="border-b border-amber-100 bg-amber-50/60 text-left text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-2.5 font-medium">Lån</th>
              <th className="px-4 py-2.5 text-right font-medium">Restgæld</th>
              <th className="px-4 py-2.5 text-right font-medium">Rente</th>
              <th className="px-4 py-2.5 text-right font-medium">Ydelse/md</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sorted.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2.5 font-medium text-neutral-900">
                  {l.name}
                  {avalanche && l.id === avalanche.id && (
                    <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      dyreste
                    </span>
                  )}
                </td>
                <td className="tabnum px-4 py-2.5 text-right font-mono text-neutral-700">
                  {formatAmount(l.balance)}
                </td>
                <td className="tabnum px-4 py-2.5 text-right font-mono text-neutral-700">
                  {l.rate != null ? `${l.rate}%` : '–'}
                </td>
                <td className="tabnum px-4 py-2.5 text-right font-mono text-neutral-600">
                  {l.monthlyPayment > 0 ? formatAmount(l.monthlyPayment) : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Anbefaling */}
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-700">
        {multiple ? (
          <>
            <span className="font-medium text-neutral-900">Anbefaling:</span> læg
            ekstra afdrag på{' '}
            <span className="font-medium text-neutral-900">{target.name}</span>{' '}
            først{avalanche ? ` (højeste rente, ${avalanche.rate}%)` : ''}. Det
            sparer jer mest i renter. Når det er betalt ud, ruller I ydelsen
            videre til det næst-dyreste lån.
            {snowballDiffers && (
              <>
                {' '}
                Vil I hellere mærke en hurtig sejr, kan I i stedet starte med{' '}
                <span className="font-medium text-neutral-900">
                  {snowball.name}
                </span>{' '}
                (mindste restgæld) og bygge momentum.
              </>
            )}
          </>
        ) : (
          <>
            <span className="font-medium text-neutral-900">Anbefaling:</span>{' '}
            ekstra afdrag på{' '}
            <span className="font-medium text-neutral-900">{target.name}</span>{' '}
            nedbringer gælden hurtigere og sparer renter.
          </>
        )}
      </div>

      {/* Håndgribelig effekt på målet */}
      {impact && impact.monthsSaved > 0 && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm leading-relaxed text-emerald-900">
          Lægger I{' '}
          <span className="font-semibold">
            {formatAmount(ILLUSTRATIVE_EXTRA)} kr ekstra
          </span>{' '}
          om måneden på {target.name}, er det betalt ud{' '}
          <span className="font-semibold">
            {formatMonthsSaved(impact.monthsSaved)}
          </span>{' '}
          tidligere, og I sparer ca.{' '}
          <span className="tabnum font-mono font-semibold">
            {formatAmount(impact.interestSaved)} kr
          </span>{' '}
          i rente.
        </div>
      )}
    </div>
  );
}
