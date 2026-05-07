'use client';

// Trin 3 af 3: "Jeres forslag" - personlig plan baseret på Step 1+2 input.
//
// Komponenten har to modes:
//
//   1. Normal mode (raadigt > 0):
//      - Result-intro med tilpasset subtitle baseret på antal antagne felter
//      - Personal-note (hvis unsureFields.length > 0)
//      - Praise-blok (logik fra praiseFragments.ts)
//      - Insight 1: 20%-historien (varianter baseret på householdAtZero)
//      - Insight 2: rådighedsbeløb-tricket (statisk)
//      - Plan-tabs ("i dag" vs "kunne se ud")
//      - Synlig note hvis assumedFields.length > 0
//      - Humble note
//      - CTA
//
//   2. Shortfall mode (raadigt <= 0):
//      - Headline + tilpasset shortfall-subtitle
//      - DROP praise-blok (forkert tone ved reel smerte)
//      - DROP plan-tabs
//      - VIS én "find missing money"-insight
//      - VIS CTA med tilpasset tekst

import Link from 'next/link';
import { calculatePlan, formatKr } from '@/lib/landing/calculatePlan';
import { buildPraiseContent } from '@/lib/landing/praiseFragments';
import type { FlowState } from '@/lib/landing/types';
import { LongTermEventBlock } from './LongTermEventBlock';
import { PlanTabs } from './PlanTabs';

const FAMBUD_FONT = 'var(--font-zt-nature), system-ui, sans-serif';

type Props = {
  state: FlowState;
};

export function StepThree({ state }: Props) {
  const plan = calculatePlan(state);

  return (
    <>
      {/* ZONE 1 - intro context (warm bg). Konstant på tværs af steps. */}
      <div className="bg-stone-100 px-5 pb-4 pt-3.5 sm:px-8 sm:pb-5 sm:pt-4">
        <span className="inline-block rounded-full border border-emerald-700 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-700">
          Find ud af det på 2 minutter
        </span>
        <h1
          className="mt-3 text-2xl text-neutral-900 sm:text-3xl"
          style={{
            fontFamily: FAMBUD_FONT,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          Du er <em className="italic text-emerald-700">tættere på</em> end du tror.
        </h1>
      </div>

      {/* ZONE 2 - working area */}
      <div className="bg-white px-5 py-5 shadow-[inset_0_2px_4px_-2px_rgba(0,0,0,0.06)] sm:px-8 sm:py-6">
        <p
          className="text-xs italic text-neutral-500 sm:text-sm"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Trin 3 af 3, jeres forslag
        </p>
        <h2
          className="mt-1 text-xl tracking-tight text-neutral-900 sm:text-2xl"
          style={{
            fontFamily: FAMBUD_FONT,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}
        >
          I har <em className="italic text-emerald-700">mere på plads</em> end I lige tænker over.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 sm:text-base">
          {buildSubtitle(plan, state)}
        </p>

        {/* Personal-note - vises hvis brugeren markerede usikker på noget */}
        {state.unsureFields.length > 0 && (
          <div className="mt-5 rounded border border-dashed border-neutral-400 bg-stone-100 px-5 py-4 sm:mt-6">
            <p
              className="text-sm font-medium text-neutral-900"
              style={{ fontFamily: FAMBUD_FONT }}
            >
              ▸ Vi snakker det igennem sammen
            </p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              I markerede at nogle af tallene var svære at sætte præcist.
              Det er helt normalt, og det er faktisk en af de første ting
              FamBud hjælper jer med. Når I logger ind, dykker vi ned i
              jeres faktiske udgifter og finder de huller I ikke vidste
              var der.
            </p>
          </div>
        )}

        {/* SHORTFALL MODE: simpler "find missing money"-version */}
        {plan.isShortfall ? (
          <ShortfallContent plan={plan} />
        ) : (
          <NormalContent plan={plan} state={state} />
        )}
      </div>
    </>
  );
}

// ----------------------------------------------------------------
// Subtitle-tekst baseret på mode + antal antagne felter
// ----------------------------------------------------------------
function buildSubtitle(
  plan: ReturnType<typeof calculatePlan>,
  state: FlowState
): React.ReactNode {
  if (plan.isShortfall) {
    return (
      <>
        Med jeres tal har I et månedligt underskud på cirka{' '}
        <strong className="font-semibold text-neutral-900">
          {formatKr(plan.shortfallAmount)} kr
        </strong>
        . Det er det første at fixe, og det er noget I sandsynligvis
        kan løse hurtigere end I tror.
      </>
    );
  }

  const assumed = plan.assumedFields.length;

  if (assumed === 0) {
    return (
      <>
        Med en månedsindkomst på cirka{' '}
        <strong className="font-semibold text-neutral-900">
          {formatKr(plan.effectiveIndkomst)} kr
        </strong>
        ,{' '}
        <strong className="font-semibold text-neutral-900">
          {formatKr(plan.effectiveFasteUdgifter)} kr
        </strong>{' '}
        i faste udgifter og{' '}
        <strong className="font-semibold text-neutral-900">
          {formatKr(plan.effectiveHusholdning)} kr
        </strong>{' '}
        til husholdning har I omkring{' '}
        <strong className="font-semibold text-emerald-700">
          {formatKr(plan.raadigt)} kr
        </strong>{' '}
        at fordele.
      </>
    );
  }

  if (assumed === 1) {
    const fieldLabel = plan.assumedFields[0] === 'udgifter' ? 'faste udgifter' : 'husholdningsforbrug';
    void state; // explicit reference for fremtidige varianter
    return (
      <>
        Vi har antaget jeres{' '}
        <strong className="font-semibold text-neutral-900">{fieldLabel}</strong>{' '}
        for at lave forslaget. Med jeres indkomst på{' '}
        <strong className="font-semibold text-neutral-900">
          {formatKr(plan.effectiveIndkomst)} kr
        </strong>{' '}
        har I omkring{' '}
        <strong className="font-semibold text-emerald-700">
          {formatKr(plan.raadigt)} kr
        </strong>{' '}
        at fordele.
      </>
    );
  }

  // assumed === 2
  return (
    <>
      Det her er et bud baseret på jeres indkomst og gennemsnitlige tal
      for danske familier. Når I logger ind, finder vi de rigtige tal
      sammen.
    </>
  );
}

// ----------------------------------------------------------------
// Normal mode content: praise + insights + plan + CTA
// ----------------------------------------------------------------
function NormalContent({
  plan,
  state,
}: {
  plan: ReturnType<typeof calculatePlan>;
  state: FlowState;
}) {
  const praise = buildPraiseContent(state.brikker);

  return (
    <>
      {/* STRAMT-advarsel: vises når events tager mere end raadigt-buffer.
          Warm bg + neutral tone (ikke alarm-rød) - det er ikke en fejl,
          det er en realistisk observation. Pointer mod FamBud som det
          værktøj der hjælper med at finjustere måned for måned. */}
      {plan.isStramt && (
        <div className="mt-5 rounded border border-stone-300 bg-stone-100 px-5 py-4 sm:mt-6 sm:px-6 sm:py-5">
          <p
            className="text-sm font-medium italic text-neutral-700"
            style={{ fontFamily: FAMBUD_FONT }}
          >
            En realitet vi gerne vil være ærlige om
          </p>
          <h4
            className="mt-1.5 text-base leading-tight text-neutral-900 sm:text-lg"
            style={{ fontFamily: FAMBUD_FONT, letterSpacing: '-0.01em' }}
          >
            Det bliver stramt at nå alle begivenheder med jeres nuværende tal.
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            Begivenhederne kræver{' '}
            <strong className="font-semibold text-neutral-900">
              {formatKr(plan.totalEventMonthly)} kr om måneden
            </strong>{' '}
            tilsammen, og det fylder hele jeres rådighed. Det betyder at
            den faste opsparing og rådighedsbeløbet er sat på pause i
            denne periode.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            I kan justere budget eller udvide tidshorisonten i FamBud,
            hvor planen kan finjusteres måned for måned, og I kan se hvad
            der reelt er plads til.
          </p>
        </div>
      )}

      {/* PRAISE-blok */}
      <div className="mt-5 rounded border border-emerald-200 bg-emerald-50 px-5 py-4 sm:mt-6 sm:px-6 sm:py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
          ★ Det her gør I rigtigt
        </p>
        <h3
          className="mt-2 text-lg leading-tight text-neutral-900 sm:text-xl"
          style={{ fontFamily: FAMBUD_FONT, letterSpacing: '-0.01em' }}
        >
          {praise.headline}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700 sm:mt-3">
          {praise.body}
        </p>
      </div>

      {/* INSIGHT 1 - 20%-historien (varianter på householdAtZero) */}
      <HouseholdInsight plan={plan} householdAtZero={state.householdAtZero} />

      {/* INSIGHT 2 - rådighedsbeløb-tricket */}
      <div className="mt-3 rounded-r border border-neutral-200 border-l-[3px] border-l-emerald-700 bg-white px-5 py-4 sm:px-6 sm:py-5">
        <p
          className="text-sm font-medium italic text-emerald-700"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Et lille trick
        </p>
        <h4
          className="mt-1.5 text-base leading-tight text-neutral-900 sm:text-lg"
          style={{ fontFamily: FAMBUD_FONT, letterSpacing: '-0.01em' }}
        >
          Et fast rådighedsbeløb til hver fjerner langt de fleste små diskussioner om penge.
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Det handler ikke om at kontrollere hinanden, tværtimod. Når I
          begge ved at I har fx{' '}
          <strong className="font-semibold text-neutral-900">
            {formatKr(plan.raadighedPerPerson)} kr
          </strong>{' '}
          om måneden til frokoster, gaver og småting, så er der ikke
          noget at tage stilling til. Det giver paradoksalt nok mere
          frihed, ikke mindre.
        </p>
      </div>

      {/* LANGSIGTEDE EVENTS - separat blok over plan-tabs. Vises kun
          hvis brugeren har valgt mindst ét event med timeframe '2-plus'
          OG budget >= 100.000 kr. */}
      <LongTermEventBlock events={plan.longTermEvents} />

      {/* PLAN-section med tabs */}
      <div className="mt-6">
        <p
          className="text-base italic text-neutral-900 sm:text-lg"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Sådan kunne en måned se ud hos jer
        </p>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Klik mellem fanerne for at se forskellen.
        </p>
        <div className="mt-3">
          <PlanTabs plan={plan} brikker={state.brikker} />
        </div>

        {/* Synlig note hvis tal er antaget. mt-3 efter delta-summary
            inde i PlanTabs (som har mt-3 efter tab-panel). */}
        {plan.assumedFields.length > 0 && (
          <p className="mt-3 text-xs italic leading-relaxed text-neutral-500">
            Vi har antaget{' '}
            {plan.assumedFields
              .map((f) =>
                f === 'udgifter'
                  ? `${formatKr(plan.effectiveFasteUdgifter)} kr i faste udgifter`
                  : `${formatKr(plan.effectiveHusholdning)} kr til husholdning`
              )
              .join(' og ')}{' '}
            baseret på et statistisk gennemsnit. Når I logger ind,
            justerer vi det med jeres faktiske tal.
          </p>
        )}
      </div>

      {/* HUMBLE NOTE - centreret italic mellem stregede dividers */}
      <p className="mx-auto my-7 max-w-md text-center text-sm italic leading-relaxed text-neutral-500 sm:my-8">
        Det her er én måde at gøre det på. Der findes mange andre, og
        det rigtige system er det I rent faktisk bruger.
      </p>

      {/* CTA-block */}
      <div className="rounded border border-dashed border-neutral-300 bg-stone-100 px-5 py-6 text-center sm:px-8 sm:py-8">
        <h3
          className="text-xl tracking-tight text-neutral-900 sm:text-2xl"
          style={{ fontFamily: FAMBUD_FONT, letterSpacing: '-0.01em' }}
        >
          Vil I prøve <em className="italic text-emerald-700">det her setup</em> i FamBud?
        </h3>
        <p className="mt-2 text-sm text-neutral-600">
          Tag jeres tal med ind. I justerer hver eneste linje undervejs.
        </p>
        <Link
          href="/signup"
          className="mt-5 inline-flex items-center gap-1.5 rounded bg-emerald-800 px-6 py-3 text-base font-semibold text-white transition hover:bg-emerald-700 sm:px-7 sm:py-3.5"
        >
          Kom i gang gratis
          <span aria-hidden>→</span>
        </Link>
        <p className="mt-3 text-xs text-neutral-500">
          Ingen kortoplysninger. 14 dages fri brug af alt.
        </p>
      </div>
    </>
  );
}

// ----------------------------------------------------------------
// Insight 1: 20%-historien - to varianter
// ----------------------------------------------------------------
function HouseholdInsight({
  plan,
  householdAtZero,
}: {
  plan: ReturnType<typeof calculatePlan>;
  householdAtZero: boolean;
}) {
  if (householdAtZero) {
    return (
      <div className="mt-5 rounded-r border border-neutral-200 border-l-[3px] border-l-emerald-700 bg-white px-5 py-4 sm:mt-6 sm:px-6 sm:py-5">
        <p
          className="text-sm font-medium italic text-emerald-700"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Det her er nok det vigtigste
        </p>
        <h4
          className="mt-1.5 text-base leading-tight text-neutral-900 sm:text-lg"
          style={{ fontFamily: FAMBUD_FONT, letterSpacing: '-0.01em' }}
        >
          Hvis husholdningen går i 0 hver måned, mister I overskuddet, uden at vide det.
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Det er en af de mest almindelige fælder. Når budgettet er
          stramt afmålt til{' '}
          <strong className="font-semibold text-neutral-900">
            {formatKr(plan.effectiveHusholdning)} kr
          </strong>
          , så bruger I{' '}
          <strong className="font-semibold text-neutral-900">
            {formatKr(plan.effectiveHusholdning)} kr
          </strong>
          . Også de måneder hvor I egentlig kunne have brugt mindre.{' '}
          <strong className="font-semibold text-neutral-900">
            Pengene fordamper i småforbrug fordi de ligger på den forkerte konto.
          </strong>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Sæt budgettet 20% højere, fx{' '}
          <strong className="font-semibold text-neutral-900">
            {formatKr(plan.husholdningMedBuffer)} kr
          </strong>
          . Det giver luft til de dyre måneder, og i de billige måneder
          ruller overskuddet automatisk over til opsparing.{' '}
          <strong className="font-semibold text-neutral-900">
            I bygger kapital uden at mærke det
          </strong>
          , og det er præcis dét FamBud er bygget til.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-r border border-neutral-200 border-l-[3px] border-l-emerald-700 bg-white px-5 py-4 sm:mt-6 sm:px-6 sm:py-5">
      <p
        className="text-sm font-medium italic text-emerald-700"
        style={{ fontFamily: FAMBUD_FONT }}
      >
        Vidste I dette?
      </p>
      <h4
        className="mt-1.5 text-base leading-tight text-neutral-900 sm:text-lg"
        style={{ fontFamily: FAMBUD_FONT, letterSpacing: '-0.01em' }}
      >
        Et husholdningsbudget bør sættes 20% højere end jeres faktiske forbrug.
      </h4>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        I bruger cirka{' '}
        <strong className="font-semibold text-neutral-900">
          {formatKr(plan.effectiveHusholdning)} kr
        </strong>{' '}
        om måneden på husholdning.{' '}
        <strong className="font-semibold text-neutral-900">
          Sæt budgettet til {formatKr(plan.husholdningMedBuffer)} kr.
        </strong>{' '}
        Det er ikke fordi I skal bruge mere, det er fordi der altid er
        måneder hvor noget går i stykker, en fødselsdag bliver dyrere,
        eller I har gæster.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        Hvis budgettet er stramt afmålt, så æder de uger ind i jeres
        opsparing. Med 20% buffer i selve husholdningen ruller det
        overskud i stedet over til næste måned, og{' '}
        <strong className="font-semibold text-neutral-900">
          så bygger I kapital uden at mærke det
        </strong>
        .
      </p>
    </div>
  );
}

// ----------------------------------------------------------------
// Shortfall mode: én fokuseret insight + tilpasset CTA
// ----------------------------------------------------------------
function ShortfallContent({ plan }: { plan: ReturnType<typeof calculatePlan> }) {
  void plan; // shortfall-tal vises i subtitle ovenfor; insight er statisk

  return (
    <>
      {/* ÉN insight - "find missing money" */}
      <div className="mt-5 rounded-r border border-neutral-200 border-l-[3px] border-l-emerald-700 bg-white px-5 py-4 sm:mt-6 sm:px-6 sm:py-5">
        <p
          className="text-sm font-medium italic text-emerald-700"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Først finder vi de manglende kroner
        </p>
        <h4
          className="mt-1.5 text-base leading-tight text-neutral-900 sm:text-lg"
          style={{ fontFamily: FAMBUD_FONT, letterSpacing: '-0.01em' }}
        >
          De fleste familier finder 1.500 til 3.000 kr om måneden de havde glemt.
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Når I logger ind, dykker vi ned i jeres faste udgifter sammen.
          Gamle abonnementer der løber videre. Forsikringer der koster
          mere end de skal. Automatiske trækninger fra apps I ikke
          bruger længere.{' '}
          <strong className="font-semibold text-neutral-900">
            Det er typisk nok til at vende underskud til balance.
          </strong>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Det er ikke en magisk løsning, det er bare det første sted at
          starte. FamBud gør det visuelt og overskueligt, så I kan se
          hvad der faktisk trækker pengene væk hver måned.
        </p>
      </div>

      {/* CTA-block med tilpasset tekst til shortfall-mode */}
      <div className="mt-7 rounded border border-dashed border-neutral-300 bg-stone-100 px-5 py-6 text-center sm:mt-8 sm:px-8 sm:py-8">
        <h3
          className="text-xl tracking-tight text-neutral-900 sm:text-2xl"
          style={{ fontFamily: FAMBUD_FONT, letterSpacing: '-0.01em' }}
        >
          Find de <em className="italic text-emerald-700">manglende kroner</em> i FamBud
        </h3>
        <p className="mt-2 text-sm text-neutral-600">
          Vi tager det step-by-step når I logger ind.
        </p>
        <Link
          href="/signup"
          className="mt-5 inline-flex items-center gap-1.5 rounded bg-emerald-800 px-6 py-3 text-base font-semibold text-white transition hover:bg-emerald-700 sm:px-7 sm:py-3.5"
        >
          Kom i gang gratis
          <span aria-hidden>→</span>
        </Link>
        <p className="mt-3 text-xs text-neutral-500">
          Ingen kortoplysninger. 14 dages fri brug af alt.
        </p>
      </div>
    </>
  );
}
