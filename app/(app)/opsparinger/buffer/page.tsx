// /opsparinger/buffer — detail-side med kalkulatoren der viser hvor lang
// tid der går før bufferen kan dække 1, 3, 6 og 12 mdr af husstandens
// faste udgifter. Selve oversigten (/opsparinger) viser kun et kompakt
// summary; al regning sker her.
//
// Mental model: "starter ved hvad jeg kan afsætte, ser timeline til mål"
// — det modsatte af "her er hvad du SKAL afsætte for at nå mål". Mere
// ærligt: ingen abstrakte anbefalinger der ikke matcher virkeligheden.

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Shield } from 'lucide-react';
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
  // Pre-fyld konto-formularen så bruger kommer ind i en form med kontotype
  // og specialfunktion sat. Navnet "Buffer" er en sikker default; bruger
  // kan altid omdøbe.
  const createBufferHref =
    '/konti/ny?kind=savings&savings_purposes=buffer&name=' +
    encodeURIComponent('Buffer');

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

      <div className="mt-6 max-w-2xl space-y-6">
        {/* Kontostatus — primært CTA når der mangler en bufferkonto, ellers
            kort statusnote. Det er det første brugeren bør kunne handle på,
            så det ligger over kalkulatoren. */}
        {bufferAccount ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
            <span className="font-medium">Bufferkonto:</span>{' '}
            {bufferAccount.name}
            {bufferAccount.monthlyInflow > 0 ? (
              <>
                {' '}
                — {formatAmount(bufferAccount.monthlyInflow)} kr/md kommer ind.
              </>
            ) : (
              <>
                {' '}
                — ingen månedlig overførsel sat op endnu.{' '}
                <Link
                  href={`/overforsler/ny?to=${encodeURIComponent(bufferAccount.id)}&recurrence=monthly&description=${encodeURIComponent('Til ' + bufferAccount.name)}`}
                  className="font-medium underline hover:no-underline"
                >
                  Sæt overførsel op
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-start">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
              <Shield className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-amber-900">
                I har ikke en bufferkonto endnu
              </div>
              <p className="mt-0.5 text-xs text-amber-800">
                Næste skridt: opret en dedikeret konto så I kan tracke jeres
                månedlige indskud. Vi pre-udfylder typen og formålet — I skal
                bare bekræfte navnet.
              </p>
            </div>
            <Link
              href={createBufferHref}
              className="inline-flex shrink-0 items-center gap-1 self-start rounded-md bg-amber-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-amber-800"
            >
              Opret bufferkonto
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

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
      </div>
    </div>
  );
}
