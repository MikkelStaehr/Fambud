// Generisk opsparings-kort i "Alle opsparingskonti"-grid på /opsparinger.
// Adskiller sig fra de anbefalede kort (BufferCard, PredictableCard) ved
// at være en simpel liste-visning af én konto med dens månedlige inflow.
//
// Klik på kortet leder til /overforsler eller /overforsler/ny afhængigt
// af om kontoen allerede har en månedlig overførsel.

import Link from 'next/link';
import { AlertCircle, ArrowRight, Check, PiggyBank } from 'lucide-react';
import {
  ACCOUNT_KIND_LABEL_DA,
  formatAmount,
  INVESTMENT_TYPE_LABEL_DA,
  SAVINGS_PURPOSE_LABEL_DA,
} from '@/lib/format';
import type { SavingsAccountWithFlow } from '@/lib/dal';

type Props = {
  account: SavingsAccountWithFlow;
};

export function SavingsCard({ account }: Props) {
  const isShared = account.owner_name === 'Fælles';
  const hasInflow = account.monthlyInflow > 0;
  // Hvis kontoen har flere savings_purposes (typisk Buffer + Forudsigelige
  // på samme konto) viser vi en kombineret label "Buffer + Forudsigelige
  // uforudsete". Det fortæller brugeren tydeligt at kontoen serverer begge
  // formål.
  const purposeLabel =
    account.savings_purposes && account.savings_purposes.length > 0
      ? account.savings_purposes
          .map((p) => SAVINGS_PURPOSE_LABEL_DA[p])
          .join(' + ')
      : null;
  const subtypeLabel = account.investment_type
    ? INVESTMENT_TYPE_LABEL_DA[account.investment_type]
    : purposeLabel
      ? purposeLabel
      : ACCOUNT_KIND_LABEL_DA[account.kind] ?? account.kind;

  const href = hasInflow
    ? `/overforsler`
    : `/overforsler/ny?to=${encodeURIComponent(account.id)}&recurrence=monthly&description=${encodeURIComponent('Til ' + account.name)}`;

  return (
    <Link
      href={href}
      className="group rounded-md border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PiggyBank className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="truncate text-sm font-semibold text-neutral-900">
              {account.name}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-neutral-500">{subtypeLabel}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                isShared
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-neutral-100 text-neutral-700'
              }`}
            >
              {account.owner_name ?? 'Personlig'}
            </span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300 transition group-hover:text-neutral-700" />
      </div>

      <div className="mt-4 border-t border-neutral-100 pt-3">
        {hasInflow ? (
          <>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700">
              <Check className="h-3 w-3" />
              <span className="font-medium">Månedlig overførsel sat op</span>
            </div>
            <div className="mt-0.5 font-mono tabnum text-base font-semibold text-neutral-900">
              +{formatAmount(account.monthlyInflow)} kr/md
            </div>
            <div className="font-mono tabnum text-xs text-neutral-500">
              {formatAmount(account.monthlyInflow * 12)} kr/år
            </div>
          </>
        ) : account.savings_purposes && account.savings_purposes.length > 0 ? (
          // Must-have savings (buffer / forudsigelige uforudsete) uden
          // overførsel = ægte advarsel. Det er fundamentet brugeren bør have.
          <>
            <div className="flex items-center gap-1.5 text-xs text-amber-700">
              <AlertCircle className="h-3 w-3" />
              <span className="font-medium">Mangler overførsel</span>
            </div>
            <div className="mt-0.5 text-xs text-neutral-500">
              Klik for at sætte op et månedligt indskud
            </div>
          </>
        ) : (
          // Nice-to-have savings (aktiedepot, aldersopsparing, ASK, ...) uden
          // overførsel = neutral information, ikke en advarsel. Brugeren har
          // måske aktivt valgt at lade kontoen ligge stille (fx ASK der er
          // fyldt op til loftet, eller aktiedepot man kun handler i ad hoc).
          <>
            <div className="text-xs text-neutral-500">
              Ingen fast overførsel
            </div>
            <div className="mt-0.5 text-xs text-neutral-400">
              Klik for at sætte op et månedligt indskud, hvis det er ønsket.
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
