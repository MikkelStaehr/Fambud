// Anbefalet "Buffer Konto"-kort på /opsparinger. Beregner 3-mdr-mål baseret
// på husstandens faste udgifter og viser timeline for hvor langt brugeren
// er. Hele værktøjet (full kalkulator med 1/3/6/12-mdr-tabel) bor på
// detail-siden /opsparinger/buffer — kortet her er kun et summary med CTA.

import Link from 'next/link';
import { ArrowRight, Shield } from 'lucide-react';
import { formatAmount, SAVINGS_PURPOSE_DESC_DA, SAVINGS_PURPOSE_LABEL_DA } from '@/lib/format';
import type { SavingsAccountWithFlow } from '@/lib/dal';
import type { SavingsPurpose } from '@/lib/database.types';
import { RecommendedCard } from './RecommendedCard';

type Props = {
  account: SavingsAccountWithFlow | undefined;
  monthlyFixedExpenses: number;
};

export function BufferCard({ account, monthlyFixedExpenses }: Props) {
  const purpose: SavingsPurpose = 'buffer';
  const hasData = monthlyFixedExpenses > 0;
  const currentInflow = account?.monthlyInflow ?? 0;
  // 3-mdr-mål er den "minimum"-tærskel vi viser på oversigten — det er
  // tommelfingerreglens første milepæl. Detail-siden har den fulde tabel
  // med 1/3/6/12 mdr.
  const target3mdr = monthlyFixedExpenses * 3;
  const monthsTo3mdr =
    currentInflow > 0 && hasData ? Math.ceil(target3mdr / currentInflow) : null;
  const isSetUp = currentInflow > 0;

  return (
    <RecommendedCard
      icon={<Shield className="h-5 w-5" />}
      iconTone="bg-emerald-50 text-emerald-800"
      label={SAVINGS_PURPOSE_LABEL_DA[purpose]}
      description={SAVINGS_PURPOSE_DESC_DA[purpose]}
      account={account}
      purposeQuery={purpose}
    >
      <div className="space-y-3 text-xs">
        {hasData ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-800">
              3 måneders dækning
            </div>
            <div className="mt-1 tabnum font-mono text-2xl font-semibold text-emerald-900">
              {formatAmount(target3mdr)} kr
            </div>
            <p className="mt-1 text-[11px] text-emerald-800">
              Faste udgifter på {formatAmount(monthlyFixedExpenses)} kr/md ×
              3. Detail-siden har den fulde tabel for 1, 3, 6 og 12 mdr.
            </p>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3 text-[11px] text-neutral-600">
            Vi kan ikke beregne målene endnu — tilføj jeres faste udgifter
            på Faste udgifter først.
          </p>
        )}

        {isSetUp && monthsTo3mdr != null && (
          <p className="text-[11px] text-neutral-600">
            I overfører{' '}
            <span className="tabnum font-mono font-medium text-neutral-900">
              {formatAmount(currentInflow)}
            </span>{' '}
            kr/md → 3-mdr-målet nås på{' '}
            <span className="font-medium">
              {monthsTo3mdr < 12
                ? `${monthsTo3mdr} mdr`
                : `${Math.floor(monthsTo3mdr / 12)} år${monthsTo3mdr % 12 ? `, ${monthsTo3mdr % 12} mdr` : ''}`}
            </span>
            .
          </p>
        )}

        <Link
          href="/opsparinger/buffer"
          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          {isSetUp ? 'Se kalkulator' : 'Sæt buffer op'}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </RecommendedCard>
  );
}
