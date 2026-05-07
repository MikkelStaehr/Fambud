'use client';

// Trin 2 af 3: "Tre tal. Det er nok."
//
// Tre numeric-inputs (indkomst, faste udgifter, husholdning) med
// live thousand-separator-formatering. Plus checkboxes for at markere
// usikkerhed eller "husholdning går i 0".
//
// Vigtigt: "Det er svært at sige" må IKKE tømme/disable input-feltet.
// Brugeren skal stadig kunne taste deres bedste gæt - vi tracker bare
// i state at de var usikre, og bruger info'en på Step 3 til at vise
// en personlig note ("vi snakker det igennem sammen").
//
// Layout: zone 1 (intro, warm bg) + zone 2 (work area, hvid bg) -
// samme pattern som StepOne. Footer ligger i modal-shell.
//
// Begivenheder: pills med multi-select, "ingen" gensidigt eksklusivt
// (samme pattern som currentSystem='none' på StepOne). Ved valg af
// et event åbnes en detail-blok med budget-input + tidsramme-pills.
// Et event uden både budget OG timeframe blokerer canProceedStep2.

import { useState } from 'react';
import type {
  EventTimeframe,
  EventType,
  UnsureField,
  UpcomingEvent,
} from '@/lib/landing/types';

const FAMBUD_FONT = 'var(--font-zt-nature), system-ui, sans-serif';

type EventDef = {
  id: EventType;
  label: string;
};

const EVENTS: readonly EventDef[] = [
  { id: 'konfirmation', label: 'Konfirmation' },
  { id: 'bryllup', label: 'Bryllup' },
  { id: 'foedselsdag', label: 'Rund fødselsdag' },
  { id: 'rejse', label: 'Større rejse' },
  { id: 'bolig', label: 'Bolig- eller bilkøb' },
  { id: 'studie', label: 'Studieafslutning' },
  { id: 'ingen', label: 'Nej, ingen lige nu' },
] as const;

const TIMEFRAMES: readonly { id: EventTimeframe; label: string }[] = [
  { id: 'under-1', label: 'Under 1 år' },
  { id: '1-2', label: '1-2 år' },
  { id: '2-plus', label: '2+ år' },
] as const;

type Props = {
  indkomst: number | null;
  fasteUdgifter: number | null;
  husholdning: number | null;
  unsureFields: UnsureField[];
  householdAtZero: boolean;
  upcomingEvents: UpcomingEvent[];
  onUpdateField: (
    field: 'indkomst' | 'fasteUdgifter' | 'husholdning',
    value: number | null
  ) => void;
  onToggleUnsure: (field: UnsureField) => void;
  onToggleHouseholdAtZero: () => void;
  onToggleEvent: (type: EventType) => void;
  onUpdateEventBudget: (type: EventType, value: number | null) => void;
  onUpdateEventTimeframe: (type: EventType, timeframe: EventTimeframe) => void;
};

export function StepTwo({
  indkomst,
  fasteUdgifter,
  husholdning,
  unsureFields,
  householdAtZero,
  upcomingEvents,
  onUpdateField,
  onToggleUnsure,
  onToggleHouseholdAtZero,
  onToggleEvent,
  onUpdateEventBudget,
  onUpdateEventTimeframe,
}: Props) {
  // Hvilke event-typer er valgt (inkl. 'ingen')
  const selectedTypes = new Set(upcomingEvents.map((e) => e.type));
  const hasIngen = selectedTypes.has('ingen');
  // Detail-blokke vises kun for ikke-ingen events
  const detailEvents = upcomingEvents.filter((e) => e.type !== 'ingen');

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
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 sm:mt-3 sm:text-base">
          Svar på et par spørgsmål om jeres husholdning. Til sidst får
          I et bud på hvordan jeres økonomi kunne se ud, uden at bruge
          en krone.
        </p>
      </div>

      {/* ZONE 2 - working area (hvid bg). Step-specific content. */}
      <div className="bg-white px-5 py-5 shadow-[inset_0_2px_4px_-2px_rgba(0,0,0,0.06)] sm:px-8 sm:py-6">
        <p
          className="text-xs italic text-neutral-500 sm:text-sm"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Trin 2 af 3
        </p>
        <h2
          className="mt-1 text-lg tracking-tight text-neutral-900 sm:text-xl"
          style={{
            fontFamily: FAMBUD_FONT,
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
          }}
        >
          Tre tal. Det er nok.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Med jeres indkomst, faste udgifter og husholdningsforbrug kan
          vi vise jer noget de fleste danske familier ikke ved om deres
          egen økonomi.{' '}
          <strong className="font-semibold text-neutral-900">
            Cirka-tal er fint.
          </strong>
        </p>

        {/* Indkomst - fuld bredde øverst på alle viewports.
            Vi har ikke "svært at sige" på indkomst fordi de fleste kan
            sætte den ret præcist (lønseddel-niveau). */}
        <div className="mt-5 sm:mt-6">
          <NumericField
            id="ltf-indkomst"
            label="Cirka indkomst om måneden"
            value={indkomst}
            onChange={(v) => onUpdateField('indkomst', v)}
            placeholder="52.000"
            suffix="kr efter skat"
            helper="Begge løn lagt sammen."
          />
        </div>

        {/* Faste udgifter + husholdning - side by side på sm+, stacked
            på mobile. Hvert felt har sin egen "svært at sige"-toggle som
            input-modifier. Det giver visuel symmetri (én toggle per
            kolonne). */}
        <div className="mt-4 grid gap-4 sm:mt-5 sm:grid-cols-2 sm:gap-5">
          <div>
            <NumericField
              id="ltf-faste"
              label="Faste udgifter"
              value={fasteUdgifter}
              onChange={(v) => onUpdateField('fasteUdgifter', v)}
              placeholder="14.000"
              suffix="kr/md"
              helper="Husleje, abonnementer, forsikringer, alt der trækkes automatisk."
            />
            <UnsureToggle
              id="ltf-unsure-udgifter"
              checked={unsureFields.includes('udgifter')}
              onToggle={() => onToggleUnsure('udgifter')}
              label="Det er svært at sige"
            />
          </div>

          <div>
            <NumericField
              id="ltf-husholdning"
              label="Udgifter til husholdning"
              value={husholdning}
              onChange={(v) => onUpdateField('husholdning', v)}
              placeholder="9.000"
              suffix="kr/md"
              helper="Mad, drikkevarer, hygiejne, det I bruger på at leve."
            />
            <UnsureToggle
              id="ltf-unsure-husholdning"
              checked={unsureFields.includes('husholdning')}
              onToggle={() => onToggleUnsure('husholdning')}
              label="Det er svært at sige"
            />
          </div>
        </div>

        {/* "Vores husholdning går i 0" - prominent "aha-blok" frem for
            discrete tickbox. De fleste familier oplever det her, så vi
            pre-validerer brugeren med en bred faktuel observation og
            inviterer dem til at genkende sig selv. Visual: warm
            bg-stone-100 + border + tydeligere tekst-vægt. Bryder
            visuelt med de små unsure-toggles ovenfor. */}
        <div className="mt-4 rounded border border-stone-200 bg-stone-100 px-4 py-3.5 sm:mt-5 sm:px-5 sm:py-4">
          <p className="text-sm font-semibold text-neutral-900">
            De fleste familier bruger hele eller tæt på hele deres
            husholdningsbudget hver måned
          </p>
          <label
            htmlFor="ltf-household-zero"
            className="mt-2 inline-flex cursor-pointer items-start gap-2.5 text-sm text-neutral-700 transition hover:text-neutral-900"
          >
            <input
              id="ltf-household-zero"
              type="checkbox"
              checked={householdAtZero}
              onChange={onToggleHouseholdAtZero}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-emerald-700"
            />
            <span className="leading-snug">
              Vores husholdning går i 0 eller tæt på hver måned
            </span>
          </label>
        </div>

        {/* Større begivenheder. Pills + per-event detail-blokke.
            Brugeren er allerede i "tal-mode" her, så det giver mening
            at lægge spørgsmålet sammen med de andre tal frem for på
            StepOne (som handler om "hvad har I på plads"). */}
        <div className="mt-5 sm:mt-6">
          <p
            className="text-sm italic text-neutral-900 sm:text-base"
            style={{ fontFamily: FAMBUD_FONT }}
          >
            Har I planer om større begivenheder de næste par år?
          </p>
          <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
            Hvis I markerer noget her, regner vi en månedlig opsparing
            ind i forslaget.
          </p>
          <div
            className="mt-2.5 flex flex-wrap gap-2"
            role="group"
            aria-label="Større begivenheder de næste par år"
          >
            {EVENTS.map((event) => {
              const isSelected = selectedTypes.has(event.id);
              // Når 'ingen' er valgt, dæmpes de andre pills (visuel
              // signaling at de er "fjernet fra play"). De er stadig
              // klikbare - tryk på en af dem rydder 'ingen'.
              const isDimmed =
                hasIngen && event.id !== 'ingen' && !isSelected;
              return (
                <EventPill
                  key={event.id}
                  label={event.label}
                  selected={isSelected}
                  dimmed={isDimmed}
                  onToggle={() => onToggleEvent(event.id)}
                />
              );
            })}
          </div>

          {/* Detail-blok per valgt event */}
          {detailEvents.map((event) => {
            const def = EVENTS.find((d) => d.id === event.type);
            if (!def) return null;
            return (
              <EventDetailBlock
                key={event.type}
                event={event}
                label={def.label}
                onUpdateBudget={(v) => onUpdateEventBudget(event.type, v)}
                onUpdateTimeframe={(t) =>
                  onUpdateEventTimeframe(event.type, t)
                }
                onRemove={() => onToggleEvent(event.type)}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------------------
// NumericField: input med live thousand-separator-formatering.
// State holder number | null. Display udledes via toLocaleString.
// On-change strips non-digits og parser som integer.
// ----------------------------------------------------------------
function NumericField({
  id,
  label,
  value,
  onChange,
  placeholder,
  suffix,
  helper,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder: string;
  suffix: string;
  helper: string;
}) {
  // Display er formatted-number eller tom string. Cursor-position kan
  // hoppe ved separator-insertion (fx 999 -> "999" -> 9999 -> "9.999")
  // men det er en kendt og acceptabel tradeoff for live-formatering.
  const display = value === null ? '' : value.toLocaleString('da-DK');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = e.target.value.replace(/[^\d]/g, '');
    if (stripped === '') {
      onChange(null);
    } else {
      onChange(parseInt(stripped, 10));
    }
  };

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm italic text-neutral-900 sm:text-base"
        style={{ fontFamily: FAMBUD_FONT }}
      >
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={display}
          onChange={handleChange}
          placeholder={placeholder}
          className="block w-full rounded border border-neutral-300 bg-stone-50 px-4 py-3 pr-24 font-mono text-base font-semibold tabular-nums text-neutral-900 placeholder:font-mono placeholder:text-neutral-400 focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-neutral-500"
        >
          {suffix}
        </span>
      </div>
      <p className="mt-1.5 text-xs italic text-neutral-500">{helper}</p>
    </div>
  );
}

// ----------------------------------------------------------------
// UnsureToggle: lille checkbox under input-felter.
// Bevidst diskret styling - vi vil ikke at brugeren tror det er
// noget de SKAL fokusere på.
// ----------------------------------------------------------------
function UnsureToggle({
  id,
  checked,
  onToggle,
  label,
}: {
  id: string;
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <label
      htmlFor={id}
      className="mt-2 inline-flex cursor-pointer items-start gap-2 text-xs text-neutral-500 transition hover:text-neutral-900"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-emerald-700"
      />
      <span className="leading-snug">{label}</span>
    </label>
  );
}

// ----------------------------------------------------------------
// EventPill: multi-select pill til event-typer. Ikke en radio fordi
// brugeren kan vælge flere events - "ingen" er gensidigt eksklusiv
// (håndteres i parent's onToggleEvent-logik).
// ----------------------------------------------------------------
function EventPill({
  label,
  selected,
  dimmed,
  onToggle,
}: {
  label: string;
  selected: boolean;
  dimmed: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`relative cursor-pointer rounded-full border px-4 py-2.5 text-sm transition ${
        selected
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : dimmed
            ? 'border-neutral-200 bg-stone-50 text-neutral-400 opacity-60 hover:opacity-100'
            : 'border-neutral-200 bg-stone-50 text-neutral-900 hover:border-neutral-900'
      }`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={selected}
        onChange={onToggle}
      />
      <span>{label}</span>
    </label>
  );
}

// ----------------------------------------------------------------
// EventDetailBlock: kort blok med budget-input + tidsramme-pills.
// X-knap øverst til højre fjerner event-typen helt (svarer til at
// af-toggle pillen).
// ----------------------------------------------------------------
function EventDetailBlock({
  event,
  label,
  onUpdateBudget,
  onUpdateTimeframe,
  onRemove,
}: {
  event: UpcomingEvent;
  label: string;
  onUpdateBudget: (value: number | null) => void;
  onUpdateTimeframe: (timeframe: EventTimeframe) => void;
  onRemove: () => void;
}) {
  const [touched, setTouched] = useState(false);
  const display =
    event.budget === null ? '' : event.budget.toLocaleString('da-DK');

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = e.target.value.replace(/[^\d]/g, '');
    if (stripped === '') {
      onUpdateBudget(null);
    } else {
      onUpdateBudget(parseInt(stripped, 10));
    }
  };

  // Soft-warning ved meget høje budgetter: 500.000+ er ikke ulovligt,
  // men det signaler typisk at brugeren har taget fejl af enheden eller
  // at vores 30-mdr-cap er for kort. Vi blokerer ikke, vi noterer det.
  const showHighBudgetNote =
    touched && event.budget !== null && event.budget >= 500000;

  return (
    <div className="relative mt-3 rounded border border-stone-200 bg-stone-50 px-4 py-3 sm:px-5 sm:py-4">
      {/* Remove-knap. Svarer til at af-toggle pillen ovenfor. */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Fjern ${label}`}
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded text-neutral-400 transition hover:bg-stone-200 hover:text-neutral-900"
      >
        <span aria-hidden className="text-lg leading-none">
          ×
        </span>
      </button>

      <p
        className="pr-8 text-sm font-semibold text-neutral-900"
        style={{ fontFamily: FAMBUD_FONT }}
      >
        {label}
      </p>

      {/* Budget-input */}
      <div className="mt-2.5">
        <label
          htmlFor={`event-budget-${event.type}`}
          className="block text-xs italic text-neutral-700"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Forventet budget
        </label>
        <div className="relative mt-1">
          <input
            id={`event-budget-${event.type}`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={display}
            onChange={handleBudgetChange}
            onBlur={() => setTouched(true)}
            placeholder="30.000"
            className="block w-full rounded border border-neutral-300 bg-white px-3 py-2.5 pr-10 font-mono text-sm font-semibold tabular-nums text-neutral-900 placeholder:font-mono placeholder:text-neutral-400 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500"
          >
            kr
          </span>
        </div>
        {showHighBudgetNote && (
          <p className="mt-1.5 text-xs italic text-neutral-500">
            Stort budget. Vi viser hvordan det kunne se ud, men det er ofte
            den slags der skal finjusteres måned for måned i FamBud.
          </p>
        )}
      </div>

      {/* Tidsramme-pills */}
      <div className="mt-3">
        <p
          className="text-xs italic text-neutral-700"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Hvornår?
        </p>
        <div
          className="mt-1.5 flex flex-wrap gap-1.5"
          role="radiogroup"
          aria-label={`Tidsramme for ${label}`}
        >
          {TIMEFRAMES.map((tf) => {
            const selected = event.timeframe === tf.id;
            return (
              <label
                key={tf.id}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs transition ${
                  selected
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-900'
                }`}
              >
                <input
                  type="radio"
                  name={`timeframe-${event.type}`}
                  className="sr-only"
                  checked={selected}
                  onChange={() => onUpdateTimeframe(tf.id)}
                />
                <span>{tf.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// canProceedStep2: util for parent (modal-shell) til at bestemme
// om "Vis vores forslag"-knappen er enabled.
//
// Logik:
//   - Indkomst skal have værdi (ingen unsure-option)
//   - Faste udgifter skal have værdi ELLER unsure='udgifter'
//   - Husholdning skal have værdi ELLER unsure='husholdning'
//   - Hvert valgt event (ikke 'ingen') skal have BÅDE budget OG timeframe
// ----------------------------------------------------------------
export function canProceedStep2(state: {
  indkomst: number | null;
  fasteUdgifter: number | null;
  husholdning: number | null;
  unsureFields: UnsureField[];
  upcomingEvents: UpcomingEvent[];
}): boolean {
  if (state.indkomst === null) return false;
  if (
    state.fasteUdgifter === null &&
    !state.unsureFields.includes('udgifter')
  ) {
    return false;
  }
  if (
    state.husholdning === null &&
    !state.unsureFields.includes('husholdning')
  ) {
    return false;
  }
  for (const event of state.upcomingEvents) {
    if (event.type === 'ingen') continue;
    if (event.budget === null || event.timeframe === null) return false;
  }
  return true;
}
