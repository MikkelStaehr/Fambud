// /opsparinger/buffer — detail-side med kalkulatoren der viser hvor lang
// tid der går før bufferen kan dække 1, 3, 6 og 12 mdr af husstandens
// faste udgifter. Selve oversigten (/opsparinger) viser kun et kompakt
// summary; al regning sker her.
//
// Mental model: "starter ved hvad jeg kan afsætte, ser timeline til mål"
// — det modsatte af "her er hvad du SKAL afsætte for at nå mål". Mere
// ærligt: ingen abstrakte anbefalinger der ikke matcher virkeligheden.

import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import {
  getHouseholdFinancialSummary,
  getSavingsAccountsWithFlow,
} from '@/lib/dal';
import { formatAmount } from '@/lib/format';
import { BufferCalculator } from '../_components/BufferCalculator';

export default async function BufferPage() {
  const [savings, summary] = await Promise.all([
    getSavingsAccountsWithFlow(),
    getHouseholdFinancialSummary(),
  ]);

  const bufferAccount = savings.find((a) =>
    a.savings_purposes?.includes('buffer')
  );
  const hasData = summary.monthlyFixedExpenses > 0;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/opsparinger"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til opsparinger
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded bg-emerald-50 text-emerald-800">
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
              Buffer Konto
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              Nødfond til jobtab, sygdom, akut reparation. Tommelfinger:
              kunne dække 3 mdr af jeres faste udgifter som minimum, 6 mdr
              ved godt niveau.
            </p>
          </div>
        </div>
      </header>

      <div className="mt-6 max-w-2xl">
        {hasData ? (
          <BufferCalculator
            monthlyFixedExpenses={summary.monthlyFixedExpenses}
            defaultMonthlyContribution={bufferAccount?.monthlyInflow ?? 0}
          />
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Vi kan ikke beregne målene endnu — I har ikke registreret nogen
            faste udgifter. Tilføj dem på{' '}
            <Link href="/faste-udgifter" className="underline">
              Faste udgifter
            </Link>{' '}
            først, så regner kalkulatoren ud fra jeres faktiske tal.
          </div>
        )}

        {bufferAccount && (
          <p className="mt-4 text-xs text-neutral-500">
            Knyttet til kontoen{' '}
            <span className="font-medium text-neutral-700">
              {bufferAccount.name}
            </span>{' '}
            ({formatAmount(bufferAccount.monthlyInflow)} kr/md kommer ind nu).
          </p>
        )}
      </div>
    </div>
  );
}
