// Fælles wrapper til både BufferCard og PredictableCard. Håndterer
// status-banner ("Konto sat op" vs "Ingen konto linket") og den
// kontekstuelle CTA (justér eksisterende overførsel vs opret konto).
// Children renderer det specifikke indhold for hver type (kalkulator-
// preview eller kategori-summary).

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { formatAmount } from '@/lib/format';
import type {
  SavingsAccountWithFlow,
  // Type kun importeret for prop-shape; ingen runtime-afhængighed.
} from '@/lib/dal';
import type { SavingsPurpose } from '@/lib/database.types';

type Props = {
  icon: React.ReactNode;
  iconTone: string;
  label: string;
  description: string;
  account: SavingsAccountWithFlow | undefined;
  purposeQuery: SavingsPurpose;
  children: React.ReactNode;
};

export function RecommendedCard({
  icon,
  iconTone,
  label,
  description,
  account,
  purposeQuery,
  children,
}: Props) {
  const isShared = account?.owner_name === 'Fælles';

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded ${iconTone}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-neutral-900">{label}</h3>
          <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
        </div>
      </div>

      <div className="mt-4 border-t border-neutral-100 pt-3">{children}</div>

      <div className="mt-4 border-t border-neutral-100 pt-3">
        {account ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                <Check className="h-3 w-3" />
                <span className="font-medium">Konto sat op:</span>
                <span className="truncate text-neutral-900">{account.name}</span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    isShared
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {account.owner_name ?? 'Personlig'}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">
                {account.monthlyInflow > 0
                  ? `Overfører ${formatAmount(account.monthlyInflow)} kr/md`
                  : 'Mangler månedlig overførsel'}
              </div>
            </div>
            <Link
              href={
                account.monthlyInflow > 0
                  ? '/overforsler'
                  : `/overforsler/ny?to=${encodeURIComponent(account.id)}&recurrence=monthly&description=${encodeURIComponent('Til ' + account.name)}`
              }
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              {account.monthlyInflow > 0 ? 'Justér' : 'Sæt op'}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            <div className="flex-1 text-[11px] text-neutral-600">
              <span className="font-medium text-neutral-700">
                Ingen konto linket.
              </span>{' '}
              Værktøjet virker uafhængigt — pengene kan stå hvor som helst.
              Link en dedikeret konto hvis I vil tracke månedlige indskud.
            </div>
            <Link
              href={`/konti/ny?kind=savings&savings_purposes=${purposeQuery}`}
              className="shrink-0 inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Opret eller link konto
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
