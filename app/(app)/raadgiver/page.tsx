import { Sparkles } from 'lucide-react';
import { getEconomyPlanData } from '@/lib/dal';
import { splitFaellesExpenses, bufferRecommendation } from '@/lib/economy-plan';
import { InfoTooltip } from '@/app/_components/InfoTooltip';
import { FaellesSplitSection } from './_components/FaellesSplitSection';
import { BufferSection } from './_components/BufferSection';

// Økonomi-rådgiveren: analyserer det husstanden har indtastet og foreslår en
// konkret opsætning. Bygges i faser - denne første dækker fordelingen af de
// fælles udgifter (proportional vs 50/50) med "tilbage til sig selv". Buffer-
// mål, manglende opsætning og Opret-handlinger følger.

export default async function RaadgiverPage() {
  const plan = await getEconomyPlanData();
  const split = splitFaellesExpenses(plan.members, plan.faellesMonthlyExpense);
  const buffer = bufferRecommendation(
    plan.monthlyFixedExpenses,
    plan.bufferMonthlyContribution
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          <Sparkles className="h-6 w-6 text-emerald-700" />
          Rådgiver
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-neutral-500">
          Forslag til hvordan I kan sætte jeres økonomi op, baseret på det I
          har indtastet. Tallene opdaterer sig efterhånden som I registrerer
          indkomst, udgifter og overførsler.
        </p>
      </header>

      {/* Sektion: Fordeling af fælles udgifter */}
      <section className="mt-8">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded bg-amber-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Fælles
          </span>
          <h2 className="text-sm font-medium text-neutral-900">
            Fordeling af fælles udgifter
          </h2>
          <InfoTooltip>
            Jeres samlede fælles udgifter delt mellem bidragyderne. Skift mellem
            proportional (efter indkomst) og 50/50, og se hvad hver har tilbage
            til sig selv bagefter. Begge modeller dækker det samme samlede beløb.
          </InfoTooltip>
        </div>

        <FaellesSplitSection
          split={split}
          faellesMonthlyExpense={plan.faellesMonthlyExpense}
          currentUserId={plan.currentUserId}
        />
      </section>

      {/* Sektion: Buffer & opsparings-mål */}
      <section className="mt-8">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-amber-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Fælles
          </span>
          <h2 className="text-sm font-medium text-neutral-900">
            Buffer & opsparings-mål
          </h2>
          <InfoTooltip>
            En buffer på 3 måneders faste udgifter dækker de fleste pludselige
            tab af indkomst. Appen har kun flow-data (ikke saldo), så vi viser
            hvor lang tid jeres nuværende indskud tager om at nå målet.
          </InfoTooltip>
        </div>

        <BufferSection
          buffer={buffer}
          bufferAccountName={plan.bufferAccountName}
          monthlyLoanPayments={plan.monthlyLoanPayments}
          hasLoans={plan.hasLoans}
        />
      </section>
    </div>
  );
}
