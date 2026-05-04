// Anbefalet "Forudsigelige uforudsete"-kort på /opsparinger. Beregner
// månedlig anbefaling baseret på brugerens kategorier (Tandlæge, Bil,
// Gaver, ...). Selve kategori-CRUD'en bor på /opsparinger/forudsigelige.

import Link from 'next/link';
import { ArrowRight, CalendarRange } from 'lucide-react';
import { sumYearlyEstimates, type SavingsAccountWithFlow } from '@/lib/dal';
import type { PredictableEstimate, SavingsPurpose } from '@/lib/database.types';
import {
  formatAmount,
  SAVINGS_PURPOSE_DESC_DA,
  SAVINGS_PURPOSE_LABEL_DA,
} from '@/lib/format';
import { RecommendedCard } from './RecommendedCard';

type Props = {
  account: SavingsAccountWithFlow | undefined;
  estimates: PredictableEstimate[];
};

export function PredictableCard({ account, estimates }: Props) {
  const purpose: SavingsPurpose = 'predictable_unexpected';

  // Beregn anbefaling fra konkrete kategorier (ikke en abstrakt %-regel).
  // Sum af årlige estimater / 12 = månedligt indskud.
  const yearlyTotal = sumYearlyEstimates(estimates);
  const monthlyRecommend = Math.round(yearlyTotal / 12 / 100) * 100; // hele 100 kr
  const hasEstimates = estimates.length > 0 && yearlyTotal > 0;
  const currentInflow = account?.monthlyInflow ?? 0;
  const meetsRecommendation =
    monthlyRecommend > 0 && currentInflow >= monthlyRecommend * 0.9;

  return (
    <RecommendedCard
      icon={<CalendarRange className="h-5 w-5" />}
      iconTone="bg-amber-50 text-amber-800"
      label={SAVINGS_PURPOSE_LABEL_DA[purpose]}
      description={SAVINGS_PURPOSE_DESC_DA[purpose]}
      account={account}
      purposeQuery={purpose}
    >
      <div className="space-y-3 text-xs">
        {hasEstimates ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-amber-800">
              Anbefalet månedligt indskud
            </div>
            <div className="mt-1 tabnum font-mono text-2xl font-semibold text-amber-900">
              {formatAmount(monthlyRecommend)} kr
            </div>
            <p className="mt-1 text-[11px] text-amber-800">
              {formatAmount(yearlyTotal)} kr/år fordelt på 12 måneder, baseret
              på {estimates.length}{' '}
              {estimates.length === 1 ? 'kategori' : 'kategorier'} I har sat op.
            </p>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3 text-[11px] text-neutral-600">
            Sæt jeres egne kategorier op for at få et konkret månedligt
            beløb - hvad bruger I om året på gaver, tandlæge, bilvedligehold
            og lignende?
          </p>
        )}

        {currentInflow > 0 && monthlyRecommend > 0 && (
          <p className="text-[11px] text-neutral-600">
            I overfører{' '}
            <span className="tabnum font-mono font-medium text-neutral-900">
              {formatAmount(currentInflow)}
            </span>{' '}
            kr/md →{' '}
            {meetsRecommendation
              ? 'I er på sporet ✓'
              : `${formatAmount(monthlyRecommend - currentInflow)} kr/md mangler`}
          </p>
        )}

        {/* CTA til detail-siden hvor selve værktøjet bor - hold oversigten
            ren. Tekst skifter alt efter om brugeren har sat noget op. */}
        <Link
          href="/opsparinger/forudsigelige"
          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          {hasEstimates ? 'Rediger kategorier' : 'Sæt kategorier op'}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </RecommendedCard>
  );
}
