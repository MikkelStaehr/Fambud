'use client';

// Plan-section med to tabs: "Sådan ser det ud i dag" og "Sådan kunne
// det se ud". Default aktiv: "kunne se ud" (det er det positive bud).
//
// Tab-switching: simpel CSS fade via key-baseret remount af panel.
// Allocation-rows er stribede ("empty") i "i dag"-tab, fyldte i
// "kunne se ud"-tab. Beskrivelser i "i dag" varierer per brik baseret
// på state.brikker (se mockup-spec).

import { useState } from 'react';
import { AllocationRow } from './AllocationRow';
import {
  eventPlanLabel,
  formatKr,
  type Plan,
} from '@/lib/landing/calculatePlan';
import type { Brik } from '@/lib/landing/types';

type TabId = 'now' | 'with';

type Props = {
  plan: Plan;
  brikker: Brik[];
};

export function PlanTabs({ plan, brikker }: Props) {
  const [active, setActive] = useState<TabId>('with');

  const indkomstPct = (amount: number): string => {
    if (plan.effectiveIndkomst === 0) return '';
    const pct = Math.round((amount / plan.effectiveIndkomst) * 100);
    return `${pct}% af indkomst`;
  };

  return (
    <div>
      {/* Tab-knapper */}
      <div
        className="flex gap-1 rounded border border-neutral-200 bg-stone-100 p-1"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={active === 'now'}
          onClick={() => setActive('now')}
          className={`flex-1 rounded-sm px-3 py-2.5 text-sm font-medium transition ${
            active === 'now'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          Sådan ser det ud i dag
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === 'with'}
          onClick={() => setActive('with')}
          className={`flex-1 rounded-sm px-3 py-2.5 text-sm font-medium transition ${
            active === 'with'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          Sådan kunne det se ud
        </button>
      </div>

      {/* Tab-panel - key trigger fade-in når tab skifter */}
      <div
        key={active}
        className="landing-flow-step mt-3 overflow-hidden rounded border border-neutral-200"
        role="tabpanel"
      >
        {active === 'now' ? (
          <NowAllocations plan={plan} brikker={brikker} indkomstPct={indkomstPct} />
        ) : (
          <WithAllocations plan={plan} indkomstPct={indkomstPct} />
        )}
      </div>

      {/* Delta-summary under tab-panel */}
      <div className="mt-3 flex flex-col gap-2 rounded border border-neutral-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5">
        {active === 'now' ? (
          <>
            <span className="text-neutral-500">
              {formatKr(plan.raadigt + plan.husholdningMedBuffer - plan.effectiveHusholdning)} kr går ind hver måned uden et klart formål.
            </span>
            <strong
              className="text-neutral-900"
              style={{ fontFamily: 'var(--font-zt-nature), system-ui, sans-serif' }}
            >
              Hvad bliver der tilovers?
            </strong>
          </>
        ) : (
          <>
            <span className="text-neutral-500">Hver krone har et formål.</span>
            <div className="text-left sm:text-right">
              <strong
                className="block text-emerald-700"
                style={{ fontFamily: 'var(--font-zt-nature), system-ui, sans-serif' }}
              >
                +{formatKr(plan.yearlyKapital)} kr om året i kapital
              </strong>
              {plan.yearlyEventSavings > 0 && !plan.isStramt && (
                <span className="mt-0.5 block text-xs text-neutral-500">
                  heraf {formatKr(plan.yearlyEventSavings)} kr øremærket til
                  {plan.eventAllocations.length === 1
                    ? ' jeres begivenhed'
                    : ` ${plan.eventAllocations.length} begivenheder`}
                </span>
              )}
              {plan.isStramt && (
                <span className="mt-0.5 block text-xs italic text-neutral-500">
                  Begivenhederne fylder hele puljen, finjuster i FamBud
                </span>
              )}
              {plan.longTermEvents.length > 0 && (
                <span className="mt-0.5 block text-xs text-neutral-500">
                  plus{' '}
                  {plan.longTermEvents.length === 1
                    ? '1 langsigtet opsparing'
                    : `${plan.longTermEvents.length} langsigtede opsparinger`}{' '}
                  som vist ovenfor
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// "I dag"-tab: faste + husholdning som filled, resten som empty/stribet
// ----------------------------------------------------------------
function NowAllocations({
  plan,
  brikker,
  indkomstPct,
}: {
  plan: Plan;
  brikker: Brik[];
  indkomstPct: (amount: number) => string;
}) {
  const hasBuffer = brikker.includes('buffer');
  const hasOpsparing = brikker.includes('opsparing');
  const hasRaadighed = brikker.includes('raadighed');

  // Resten = raadigt før husholdning-buffer (fordi husholdning vises
  // her uden 20%-tillæg). Det matcher mockup'ens "29.000 kr"-resten.
  const restenIDag =
    plan.effectiveIndkomst -
    plan.effectiveFasteUdgifter -
    plan.effectiveHusholdning;

  return (
    <div className="flex flex-col gap-px bg-neutral-100">
      <AllocationRow
        icon="⌂"
        iconBg="#E5E0F0"
        label="Faste udgifter"
        subtext="Bliver betalt, det fungerer"
        amount={`${formatKr(plan.effectiveFasteUdgifter)} kr`}
        amountSub={indkomstPct(plan.effectiveFasteUdgifter)}
      />
      <AllocationRow
        icon="⊞"
        iconBg="#FAE8D9"
        label="Husholdning"
        subtext="Uden 20% buffer, stramt afmålt"
        amount={`${formatKr(plan.effectiveHusholdning)} kr`}
        amountSub="Uden margin"
      />
      <AllocationRow
        icon="◐"
        iconBg="#FCE8DC"
        label="Buffer"
        subtext={hasBuffer ? 'I har en, men uden fast bidrag' : 'I har ikke en buffer endnu'}
        amount="0 kr"
        amountSub="Vokser ikke"
        variant="empty"
      />
      <AllocationRow
        icon="↗"
        iconBg="#DDE9DF"
        label="Fast opsparing"
        subtext={hasOpsparing ? 'I sparer op, men ikke systematisk' : 'I sparer ikke fast op endnu'}
        amount="0 kr"
        amountSub="Det der er tilbage"
        variant="empty"
      />
      <AllocationRow
        icon="◇"
        iconBg="#F0E5D5"
        label="Rådighedsbeløb til hver"
        subtext={hasRaadighed ? 'I har et system, vi viser hvordan det kunne se ud' : 'I deler den samme pulje'}
        amount="0 kr"
        amountSub="Ingen klare aftaler"
        variant="empty"
      />
      <div className="bg-stone-100 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="grid grid-cols-[32px_1fr_auto] items-center gap-3 sm:gap-4">
          <div
            className="flex h-8 w-8 items-center justify-center text-neutral-600"
            aria-hidden
          >
            ●
          </div>
          <div className="min-w-0">
            <strong className="block text-sm font-semibold leading-tight text-neutral-900">
              Resten
            </strong>
            <span className="mt-0.5 block text-xs text-neutral-500">
              Forsvinder typisk i småforbrug
            </span>
          </div>
          <div className="text-right">
            <span
              className="block text-base font-semibold tabular-nums text-neutral-900 sm:text-lg"
              style={{ fontFamily: 'var(--font-zt-nature), system-ui, sans-serif' }}
            >
              {formatKr(restenIDag)} kr
            </span>
            <span className="mt-0.5 block text-[11px] text-neutral-500">
              Uden klar plan
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// "Kunne se ud"-tab: alle rækker filled med beregnede tal.
// Rækkefølge: Faste → Husholdning+20% → Buffer → Events → Opsparing → Rådighed.
// I stramt-mode (events overstiger raadigt-buffer) er Opsparing og
// Rådighed tomme/stribede - StepThree viser advarslen ovenfor.
// ----------------------------------------------------------------
function WithAllocations({
  plan,
  indkomstPct,
}: {
  plan: Plan;
  indkomstPct: (amount: number) => string;
}) {
  const yearlyOpsparing = plan.opsparing * 12;
  const raadighedTotal = plan.raadighedPerPerson * 2;

  return (
    <div className="flex flex-col gap-px bg-neutral-100">
      <AllocationRow
        icon="⌂"
        iconBg="#E5E0F0"
        label="Faste udgifter"
        subtext="Husleje, abonnementer, forsikringer"
        amount={`${formatKr(plan.effectiveFasteUdgifter)} kr`}
        amountSub={indkomstPct(plan.effectiveFasteUdgifter)}
      />
      <AllocationRow
        icon="⊞"
        iconBg="#FAE8D9"
        label="Husholdning + 20% buffer"
        subtext={`${formatKr(plan.effectiveHusholdning)} kr forbrug, ${formatKr(plan.husholdningMedBuffer - plan.effectiveHusholdning)} kr ekstra margin`}
        amount={`${formatKr(plan.husholdningMedBuffer)} kr`}
        amountSub="Overskud ruller over"
      />
      <AllocationRow
        icon="◐"
        iconBg="#FCE8DC"
        label="Buffer"
        subtext="Bygges op til 30.000 kr, så stopper den"
        amount={`${formatKr(plan.buffer)} kr`}
        amountSub={
          plan.buffer > 0
            ? `Mål nået på ${Math.ceil(30000 / plan.buffer)} mdr`
            : ''
        }
      />

      {/* Event-rækker, én per allocation. Vises efter buffer fordi det
          er en form for øremærket opsparing - mere konkret end "fast
          opsparing", men også mere forpligtende. */}
      {plan.eventAllocations.map((event) => (
        <AllocationRow
          key={event.type}
          icon="◇"
          iconBg="#E5DCEF"
          label={eventPlanLabel(event.type)}
          subtext={`${formatKr(event.budget)} kr på ${event.months} måneder`}
          amount={`${formatKr(event.monthly)} kr`}
          amountSub={
            plan.isStramt
              ? 'Stramt, juster i FamBud'
              : `${formatKr(event.monthly * 12)} kr om året`
          }
        />
      ))}

      <AllocationRow
        icon="↗"
        iconBg="#DDE9DF"
        label="Fast opsparing"
        subtext={
          plan.isStramt
            ? 'Begivenhederne fylder hele puljen lige nu'
            : 'Ferie, nyt køkken, hvad I aftaler'
        }
        amount={
          plan.isStramt ? '0 kr' : `${formatKr(plan.opsparing)} kr`
        }
        amountSub={
          plan.isStramt
            ? 'Vokser igen når begivenhederne er nået'
            : `${formatKr(yearlyOpsparing)} kr om året`
        }
        variant={plan.isStramt ? 'empty' : 'filled'}
      />
      <AllocationRow
        icon="◇"
        iconBg="#F0E5D5"
        label="Rådighedsbeløb til hver"
        subtext={
          plan.isStramt
            ? 'Begrænset plads i denne periode'
            : 'Til frokoster, gaver, småting'
        }
        amount={
          plan.isStramt
            ? '0 kr'
            : `2 × ${formatKr(plan.raadighedPerPerson)} kr`
        }
        amountSub={
          plan.isStramt
            ? 'Genåbner senere'
            : `${formatKr(raadighedTotal)} kr i alt`
        }
        variant={plan.isStramt ? 'empty' : 'filled'}
      />
    </div>
  );
}
