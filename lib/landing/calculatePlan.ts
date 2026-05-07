// Beregningslogik for "Find ud af det selv"-flowet på Step 3.
//
// Formel-logik (uden begivenheder):
//   husholdningMedBuffer = husholdning * 1.20
//   raadigt = indkomst - fasteUdgifter - husholdningMedBuffer
//   buffer = min(raadigt * 0.10, 3000)        ← 3000 er max, ikke target
//   baseOpsparing = min(raadigt * 0.10, 3000)
//   tilbage = raadigt - buffer - baseOpsparing
//   raadighedPerPerson = min(tilbage / 2, 5000)
//   overflow = (tilbage / 2 - raadighedPerPerson) * 2
//   opsparing = baseOpsparing + overflow       ← ÉN samlet opsparing-række
//   yearlyKapital = (buffer + opsparing) * 12
//
// Begivenheder klassificeres i to spande:
//   1. Kortsigtede (eventAllocations): budget/months bidrager til
//      månedlig allocation efter buffer men før opsparing/rådighed.
//   2. Langsigtede (longTermEvents): timeframe='2-plus' OG budget
//      >= 100.000 kr. Konkurrerer IKKE med månedlig cashflow.
//      Vises i separat blok på StepThree med peg mod FamBud.
//
// Stramt-mode trigger: afterBufferAndShortEvents <= 0. Kun
// kortsigtede events tæller med her - langsigtede er udenfor planen.
//
// Edge cases:
//   1. fasteUdgifter null + unsure: brug 30% af indkomst (statistisk
//      gennemsnit for danske familier). Samme for husholdning (17%).
//   2. raadigt <= 0 (udgifter > indkomst): returnér shortfall-mode.
//      Begge event-typer droppes (vi løser underskuddet først).
//   3. Alle events langsigtede: planen vises som om brugeren ingen
//      events havde valgt, og long-term-blokken kommer øverst på Step 3.
//   4. Et event uden budget eller timeframe filtreres væk inden
//      beregning - canProceedStep2 burde forhindre det, men logikken
//      er defensiv.

import type {
  EventTimeframe,
  EventType,
  FlowState,
  UpcomingEvent,
} from './types';

export type EventAllocation = {
  type: EventType;
  budget: number;
  months: number;
  monthly: number;
};

// Langsigtet event: timeframe='2-plus' OG budget >= 100.000 kr.
// Beholder timeframe på typen så fremtidige varianter (fx 5+ år)
// kan udvides uden Plan-kontrakt-brud.
export type LongTermEvent = {
  type: EventType;
  budget: number;
  timeframe: EventTimeframe;
};

export type Plan = {
  // Mode-flags
  isShortfall: boolean;
  isStramt: boolean; // kortsigtede events overstiger raadigt-buffer

  // Faktiske tal brugt i beregning (efter assumed-fallback for null+unsure)
  effectiveIndkomst: number;
  effectiveFasteUdgifter: number;
  effectiveHusholdning: number;

  // Hvilke felter er antaget pga. null + unsure
  assumedFields: ('udgifter' | 'husholdning')[];

  // Beregnede beløb (alle 0 i shortfall-mode)
  raadigt: number;
  shortfallAmount: number; // |raadigt| når shortfall, 0 ellers
  husholdningMedBuffer: number;
  buffer: number;
  opsparing: number;
  raadighedPerPerson: number;
  yearlyKapital: number; // (buffer + opsparing + kortsigtede events) * 12

  // Events - kortsigtede i plan, langsigtede i separat blok
  eventAllocations: EventAllocation[];
  totalEventMonthly: number;
  yearlyEventSavings: number; // kortsigtede * 12 (sub-linje i delta-summary)
  longTermEvents: LongTermEvent[];
};

// Statistiske defaults når brugeren har markeret "svært at sige".
// 30% af indkomst er gennemsnittet for danske familiers faste udgifter.
// 17% er gennemsnittet for husholdningsforbrug.
const DEFAULT_FASTE_PCT = 0.30;
const DEFAULT_HUSHOLDNING_PCT = 0.17;

// Plan-konstanter
const HUSHOLDNING_BUFFER_MULTIPLIER = 1.20;
const BUFFER_RATE = 0.10;
const BUFFER_MAX = 3000;
const OPSPARING_RATE = 0.10;
const OPSPARING_MAX = 3000;
const RAADIGHED_PER_PERSON_MAX = 5000;

// Tidsramme -> måneder. Under-1 = 9 mdr (gennemsnit af 6-12).
// 1-2 år = 18 mdr. 2+ år = 30 mdr (vi standardiserer på 2.5 år for at
// undgå at skubbe planen langt ud i fremtiden).
const TIMEFRAME_MONTHS: Record<EventTimeframe, number> = {
  'under-1': 9,
  '1-2': 18,
  '2-plus': 30,
};

// Langsigtet-tærskel. Eksporteres så tests/Step2 evt. kan bruge dem.
export const LONG_TERM_THRESHOLD_BUDGET = 100000;
export const LONG_TERM_THRESHOLD_TIMEFRAME: EventTimeframe = '2-plus';

// Et event er langsigtet hvis BÅDE timeframe matcher OG budget er
// over tærsklen. Et 50.000 kr 2+ års-mål er stadig kortsigtet (passer
// i månedlig allocation), og et 200.000 kr 1-2 års-mål er stadig
// kortsigtet (det skal nås i en konkret tidsramme).
function isLongTermEvent(e: UpcomingEvent): boolean {
  if (e.type === 'ingen') return false;
  if (e.budget === null || e.timeframe === null) return false;
  return (
    e.timeframe === LONG_TERM_THRESHOLD_TIMEFRAME &&
    e.budget >= LONG_TERM_THRESHOLD_BUDGET
  );
}

function calculateEventAllocations(
  events: UpcomingEvent[]
): EventAllocation[] {
  return events
    .filter(
      (e) =>
        e.type !== 'ingen' &&
        e.budget !== null &&
        e.timeframe !== null &&
        !isLongTermEvent(e)
    )
    .map((e) => {
      const months = TIMEFRAME_MONTHS[e.timeframe as EventTimeframe];
      const budget = e.budget as number;
      return {
        type: e.type,
        budget,
        months,
        monthly: Math.round(budget / months),
      };
    });
}

function calculateLongTermEvents(
  events: UpcomingEvent[]
): LongTermEvent[] {
  return events.filter(isLongTermEvent).map((e) => ({
    type: e.type,
    budget: e.budget as number,
    timeframe: e.timeframe as EventTimeframe,
  }));
}

export function calculatePlan(state: FlowState): Plan {
  // Indkomst er obligatorisk - canProceedStep2 sikrer det. Hvis vi
  // alligevel ender her med null, returnér en tom shortfall-state
  // så UI ikke crasher.
  const effectiveIndkomst = state.indkomst ?? 0;

  // Faste udgifter: brug input hvis sat, ellers 30% af indkomst når
  // brugeren markerede unsure. Hvis hverken input eller unsure, brug 0
  // (det burde ikke ske pga. canProceedStep2-validation).
  const fasteIsAssumed =
    state.fasteUdgifter === null && state.unsureFields.includes('udgifter');
  const effectiveFasteUdgifter = fasteIsAssumed
    ? Math.round(effectiveIndkomst * DEFAULT_FASTE_PCT)
    : (state.fasteUdgifter ?? 0);

  // Husholdning: samme pattern, 17% default når unsure
  const husholdningIsAssumed =
    state.husholdning === null && state.unsureFields.includes('husholdning');
  const effectiveHusholdning = husholdningIsAssumed
    ? Math.round(effectiveIndkomst * DEFAULT_HUSHOLDNING_PCT)
    : (state.husholdning ?? 0);

  const assumedFields: ('udgifter' | 'husholdning')[] = [];
  if (fasteIsAssumed) assumedFields.push('udgifter');
  if (husholdningIsAssumed) assumedFields.push('husholdning');

  const husholdningMedBuffer = Math.round(
    effectiveHusholdning * HUSHOLDNING_BUFFER_MULTIPLIER
  );
  const raadigt =
    effectiveIndkomst - effectiveFasteUdgifter - husholdningMedBuffer;

  const eventAllocations = calculateEventAllocations(state.upcomingEvents);
  const longTermEvents = calculateLongTermEvents(state.upcomingEvents);
  const totalEventMonthly = eventAllocations.reduce(
    (sum, e) => sum + e.monthly,
    0
  );

  // Shortfall-mode: udgifter overstiger indkomst. Step 3 skal vise
  // simplere "find missing money"-version. BEGGE event-typer droppes
  // her - vi løser underskuddet først, langsigtede mål giver ikke
  // mening at diskutere før underskuddet er væk.
  if (raadigt <= 0) {
    return {
      isShortfall: true,
      isStramt: false,
      effectiveIndkomst,
      effectiveFasteUdgifter,
      effectiveHusholdning,
      assumedFields,
      raadigt: 0,
      shortfallAmount: Math.abs(raadigt),
      husholdningMedBuffer,
      buffer: 0,
      opsparing: 0,
      raadighedPerPerson: 0,
      yearlyKapital: 0,
      eventAllocations: [],
      totalEventMonthly: 0,
      yearlyEventSavings: 0,
      longTermEvents: [],
    };
  }

  // Normal mode
  const buffer = Math.min(raadigt * BUFFER_RATE, BUFFER_MAX);
  const afterBufferAndEvents = raadigt - buffer - totalEventMonthly;

  // Stramt: events tager mere end raadigt-buffer. Vi viser stadig
  // events i planen (ideal-tal), men opsparing/rådighed = 0 og
  // StepThree viser en advarsel.
  const isStramt = afterBufferAndEvents <= 0;

  let opsparing = 0;
  let raadighedPerPerson = 0;

  if (afterBufferAndEvents > 0) {
    const baseOpsparing = Math.min(
      afterBufferAndEvents * OPSPARING_RATE,
      OPSPARING_MAX
    );
    const tilbage = afterBufferAndEvents - baseOpsparing;

    const raadighedPerPersonRaw = Math.max(0, tilbage) / 2;
    raadighedPerPerson = Math.min(
      raadighedPerPersonRaw,
      RAADIGHED_PER_PERSON_MAX
    );

    // Overflow fra rådighed-cap går tilbage i opsparingen (ÉN samlet
    // række frem for to forvirrende opsparings-linjer).
    const overflow = Math.max(
      0,
      (raadighedPerPersonRaw - raadighedPerPerson) * 2
    );
    opsparing = baseOpsparing + overflow;
  }

  const yearlyEventSavings = totalEventMonthly * 12;
  // Stramt: events kan ikke alle fuldt dækkes, så delta-summary skal
  // afspejle den realistiske ceiling (raadigt) frem for et urealistisk
  // ideal-tal. Normalt er buffer + opsparing + events = raadigt
  // alligevel, men i stramt afviger det.
  const yearlyKapital = isStramt
    ? Math.round(raadigt * 12)
    : (buffer + opsparing + totalEventMonthly) * 12;

  return {
    isShortfall: false,
    isStramt,
    effectiveIndkomst,
    effectiveFasteUdgifter,
    effectiveHusholdning,
    assumedFields,
    raadigt: Math.round(raadigt),
    shortfallAmount: 0,
    husholdningMedBuffer,
    buffer: Math.round(buffer),
    opsparing: Math.round(opsparing),
    raadighedPerPerson: Math.round(raadighedPerPerson),
    yearlyKapital: Math.round(yearlyKapital),
    eventAllocations,
    totalEventMonthly: Math.round(totalEventMonthly),
    yearlyEventSavings: Math.round(yearlyEventSavings),
    longTermEvents,
  };
}

// Format helper for de tal der vises i UI. Dansk locale med
// thousand-separator (12345 -> "12.345").
export function formatKr(amount: number): string {
  return amount.toLocaleString('da-DK');
}

// Plan-label for et event (vises i AllocationRow.label).
// Bruges af PlanTabs til at rendere "Opsparing til konfirmation" osv.
export function eventPlanLabel(type: EventType): string {
  switch (type) {
    case 'konfirmation':
      return 'Opsparing til konfirmation';
    case 'bryllup':
      return 'Opsparing til bryllup';
    case 'foedselsdag':
      return 'Opsparing til rund fødselsdag';
    case 'rejse':
      return 'Opsparing til rejse';
    case 'bolig':
      return 'Opsparing til bolig eller bil';
    case 'studie':
      return 'Opsparing til studieafslutning';
    case 'ingen':
      return '';
  }
}
