import { Sparkles } from 'lucide-react';
import { getEconomyPlanData, shouldShowTour } from '@/lib/dal';
import {
  splitFaellesExpenses,
  bufferRecommendation,
  computeFiftyThirtyTwenty,
  detectSetupGaps,
} from '@/lib/economy-plan';
import { InfoTooltip } from '@/app/_components/InfoTooltip';
import { FaellesSplitSection } from './_components/FaellesSplitSection';
import { BufferSection } from './_components/BufferSection';
import { AllokerSection } from './_components/AllokerSection';
import { FiftyThirtyTwentySection } from './_components/FiftyThirtyTwentySection';
import { LaaneoptimeringSection } from './_components/LaaneoptimeringSection';
import { ManglerSection } from './_components/ManglerSection';
import { RaadgiverTour } from './_components/RaadgiverTour';

// Økonomi-rådgiveren: analyserer det husstanden har indtastet og foreslår en
// konkret opsætning. Bygges i faser - denne første dækker fordelingen af de
// fælles udgifter (proportional vs 50/50) med "tilbage til sig selv". Buffer-
// mål, manglende opsætning og Opret-handlinger følger.

export default async function RaadgiverPage() {
  const [plan, autoStartTour] = await Promise.all([
    getEconomyPlanData(),
    shouldShowTour('raadgiver'),
  ]);
  const buffer = bufferRecommendation(
    plan.monthlyFixedExpenses,
    plan.bufferMonthlyContribution
  );
  // Buffer-andelen indgår nu i fordelings-tabellen som anden underkolonne
  // ved hver beløbs-celle, så total "betaler til fælles" matcher "alt der
  // bør gå ind på fælleskonti" (udgifter + opsparing).
  const split = splitFaellesExpenses(
    plan.members,
    plan.faellesMonthlyExpense,
    buffer.recommendedMonthly
  );
  const bufferOnTrack =
    buffer.monthsAtCurrentRate != null &&
    buffer.monthsAtCurrentRate <= buffer.reachInMonths;

  // 50/30/20 på den indloggede brugers egen økonomi (privacy-sikkert).
  const meMember = plan.members.find((m) => m.userId === plan.currentUserId);
  const ftt = meMember
    ? computeFiftyThirtyTwenty({
        income: meMember.monthlyIncome,
        faellesContribution: meMember.currentContribution,
        privateGroups: plan.privateExpenseGroups,
      })
    : null;

  const setupGaps = detectSetupGaps({
    myHasLonkonto: plan.myHasLonkonto,
    myHasAnyIncome: plan.myHasAnyIncome,
    myIncomeComplete: plan.myIncomeComplete,
    members: plan.memberStatuses,
  });

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <RaadgiverTour autoStart={autoStartTour} />
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

      {/* Sektion: Manglende opsætning (først - huller her påvirker alt nedenfor) */}
      <section className="mt-8" data-tour="raadgiver-mangler">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-medium text-neutral-900">
            Manglende opsætning
          </h2>
          <InfoTooltip>
            Strukturelle huller i jeres opsætning der påvirker hvor præcis
            rådgivningen er. Dine egne huller får en knap; partnerens skal de
            selv udfylde i deres egen wizard.
          </InfoTooltip>
        </div>
        <ManglerSection gaps={setupGaps} />
      </section>

      {/* Sektion: Fordeling af fælles udgifter */}
      <section className="mt-8" data-tour="raadgiver-fordeling">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded bg-amber-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Fælles
          </span>
          <h2 className="text-sm font-medium text-neutral-900">
            Fordeling af fælles udgifter
          </h2>
          <InfoTooltip>
            Jeres samlede fælles udgifter delt mellem bidragyderne. Skift mellem
            tre modeller: proportional (efter indkomst), 50/50, og udlignet
            rådighed (begge ender med samme beløb til sig selv). Se hvad hver
            har tilbage bagefter - alle tre dækker det samme samlede beløb.
          </InfoTooltip>
        </div>

        <FaellesSplitSection
          split={split}
          faellesMonthlyExpense={plan.faellesMonthlyExpense}
          currentUserId={plan.currentUserId}
          primaryFaellesAccountId={plan.primaryFaellesAccountId}
          primaryFaellesAccountName={plan.primaryFaellesAccountName}
          bufferAccountId={plan.bufferAccountId}
          bufferAccountName={plan.bufferAccountName}
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

      {/* Sektion: Allokér dit overskud */}
      <section className="mt-8" data-tour="raadgiver-optimering">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Privat
          </span>
          <h2 className="text-sm font-medium text-neutral-900">
            Allokér dit overskud
          </h2>
          <InfoTooltip>
            En prioritering af det du har tilbage hver måned. Baseret på dit
            faktiske overskud - ikke et opdigtet beløb. Rækkefølgen følger
            klassisk personlig økonomi: sikkerhed (buffer) før dyr gæld før
            langsigtet opsparing.
          </InfoTooltip>
        </div>

        <AllokerSection
          surplus={plan.privatSurplus}
          bufferOnTrack={bufferOnTrack}
          mostExpensiveLoan={plan.mostExpensiveLoan}
        />
      </section>

      {/* Sektion: 50/30/20-budgetmodel */}
      {ftt && (
        <section className="mt-8">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Privat
            </span>
            <h2 className="text-sm font-medium text-neutral-900">
              50/30/20-budgetmodel
            </h2>
            <InfoTooltip>
              En klassisk tommelfingerregel: ca. 50% af nettoindkomsten til
              nødvendigheder, 30% til forbrug, 20% til opsparing. Vist for din
              egen økonomi (partnerens private forbrug er skjult). Klassificeringen
              er gennemsigtig, så du kan vurdere om den passer.
            </InfoTooltip>
          </div>

          <FiftyThirtyTwentySection ftt={ftt} />
        </section>
      )}

      {/* Sektion: Låneoptimering */}
      <section className="mt-8">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-amber-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Fælles
          </span>
          <h2 className="text-sm font-medium text-neutral-900">
            Låneoptimering
          </h2>
          <InfoTooltip>
            Hvilket lån skal ekstra afdrag på først? Avalanche (højeste rente
            først) sparer mest i renter; snowball (mindste lån først) giver en
            hurtig sejr. Tallene er beregnet ud fra restgæld, rente og ydelse.
          </InfoTooltip>
        </div>

        <LaaneoptimeringSection loans={plan.loans} />
      </section>
    </div>
  );
}
