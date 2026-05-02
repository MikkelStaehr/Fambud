// /opsparinger — den tredje del af "budget-treenigheden":
//   1. Faste udgifter (/budget) — det der trækkes hver måned
//   2. Husholdning (/husholdning) — daily-spend tracking
//   3. Opsparinger & buffer (denne side) — det der lægges til side
//
// Sidens opbygning:
//   - Anbefalede opsparinger (ØVERST) — to "must-have"-konti vi aktivt
//     foreslår: Buffer Konto og Forudsigelige uforudsete. Hver med beregnet
//     målbeløb baseret på brugerens egne tal (faste udgifter, nettoindkomst).
//     Hvis konto ikke findes: prompt om at oprette. Hvis findes: vis
//     overførsels-status.
//   - Alle opsparinger (NEDERST) — konventionel liste over alle
//     opsparings/investeringskonti med deres månedlige indskud.
//
// Buffer + predictable_unexpected er identificeret via accounts.savings_purposes
// (migration 0029, omdøbt fra savings_purpose). Det er nu et array, så ÉN
// konto kan dække begge formål samtidig — typisk for familier der har én
// "Bufferkonto" til både nødfond og forudsigelige uforudsete.

import Link from 'next/link';
import { Plus, PiggyBank } from 'lucide-react';
import {
  getHouseholdFinancialSummary,
  getPredictableEstimates,
  getSavingsAccountsWithFlow,
} from '@/lib/dal';
import { formatAmount } from '@/lib/format';
import { BufferCard } from './_components/BufferCard';
import { PredictableCard } from './_components/PredictableCard';
import { SavingsCard } from './_components/SavingsCard';

export default async function OpsparingerPage() {
  const [savings, summary, predictableEstimates] = await Promise.all([
    getSavingsAccountsWithFlow(),
    getHouseholdFinancialSummary(),
    getPredictableEstimates(),
  ]);

  const totalInflow = savings.reduce((s, a) => s + a.monthlyInflow, 0);

  // Find første konto med hvert tag. En konto kan have BEGGE tags — så
  // bufferAccount og predictableAccount kan pege på samme konto. Det er
  // bevidst: brugeren kan tagge én konto med begge formål.
  const bufferAccount = savings.find((a) =>
    a.savings_purposes?.includes('buffer')
  );
  const predictableAccount = savings.find((a) =>
    a.savings_purposes?.includes('predictable_unexpected')
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-200 pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Opsparinger & buffer
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {savings.length === 0
                ? 'Ingen opsparingskonti endnu'
                : `${savings.length} konti · ${formatAmount(totalInflow)} kr/md sættes til side`}
            </p>
          </div>
          <Link
            href="/konti/ny"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <Plus className="h-4 w-4" />
            Ny konto
          </Link>
        </div>
      </header>

      {/* Anbefalede konti — det vigtige er at brugeren VED de bør have
          disse. Vi viser dem altid, uanset om brugeren har dem eller ej. */}
      <section className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Anbefalede opsparinger
        </h2>
        <p className="mb-4 max-w-2xl text-xs text-neutral-500">
          To opsparinger vi anbefaler at I prioriterer — beregnet ud fra jeres
          egne tal. De øvrige (aldersopsparing, aktiesparekonto, ferieopsparing
          mv.) er nice-to-have; disse er fundamentet.
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          <BufferCard
            account={bufferAccount}
            monthlyFixedExpenses={summary.monthlyFixedExpenses}
          />
          <PredictableCard
            account={predictableAccount}
            estimates={predictableEstimates}
          />
        </div>
      </section>

      {/* Alle opsparinger */}
      <section className="mt-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Alle opsparingskonti
        </h2>
        {savings.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <PiggyBank className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-sm text-neutral-500">
              Ingen opsparings- eller investeringskonti endnu.
            </p>
            <Link
              href="/konti/ny"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Opret konto
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {savings.map((s) => (
              <SavingsCard key={s.id} account={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
