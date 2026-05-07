'use client';

// Trin 1 af 3: "Hvilke brikker har I på plads?"
//
// Layout-strategi: to-zone struktur. Zone 1 (warm beige bg-stone-100)
// har intro-context. Zone 2 (hvid bg) har det interaktive arbejde.
// Visuel adskillelse via subtle shadow på toppen af zone 2 (lift-feel).
//
// Footeren er IKKE i denne komponent længere - den ligger i modal-shell
// (LandingFlowModalTrigger) så footer-content kan variere efter step
// uden at hver step skal duplikere knap-logik.

import type { Brik, CurrentSystem } from '@/lib/landing/types';

type BrikDef = {
  id: Brik;
  title: string;
  body: string;
};

const BRIKKER: readonly BrikDef[] = [
  { id: 'buffer', title: 'Buffer', body: 'Penge til når vaskemaskinen går i stykker' },
  { id: 'opsparing', title: 'Opsparing', body: 'Til ferier, nyt køkken, en bil' },
  { id: 'alder', title: 'Aldersopsparing', body: 'Udover det arbejdsgiver lægger til' },
  { id: 'boern', title: 'Børneopsparing', body: 'Til når de fylder 18 eller flytter hjemmefra' },
  { id: 'raadighed', title: 'Fast rådighedsbeløb', body: 'Hver sit, så I ikke skal forhandle om småting' },
  { id: 'fordeling', title: 'System til fælles udgifter', body: 'Hvem betaler hvad, og hvor meget' },
] as const;

type SystemDef = {
  id: CurrentSystem;
  label: string;
};

const SYSTEMS: readonly SystemDef[] = [
  { id: 'sheet', label: 'Et regneark' },
  { id: 'app', label: 'En app' },
  { id: 'head', label: 'I hovedet' },
  { id: 'none', label: 'Vi gør det egentlig ikke' },
] as const;

const FAMBUD_FONT = 'var(--font-zt-nature), system-ui, sans-serif';

type Props = {
  brikker: Brik[];
  currentSystem: CurrentSystem | null;
  onToggleBrik: (brik: Brik) => void;
  onSelectSystem: (system: CurrentSystem) => void;
};

export function StepOne({
  brikker,
  currentSystem,
  onToggleBrik,
  onSelectSystem,
}: Props) {
  return (
    <>
      {/* ZONE 1 - Kontekst-zone. Warm beige (stone-100) som matcher
          mockup'ens warm-tone-fornemmelse uden at gå all-in på beige
          (vores design system bruger stone-paletter overalt).
          Kompakt padding fordi intro skal være tæt - resten af
          plads-budget går til zone 2. */}
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

      {/* ZONE 2 - Arbejds-zone. Hvid baggrund + subtle inset shadow på
          toppen for at give "lift" fra zone 1 uden hård linje.
          Luftigere padding end zone 1 - det er her arbejdet sker. */}
      <div className="bg-white px-5 py-5 shadow-[inset_0_2px_4px_-2px_rgba(0,0,0,0.06)] sm:px-8 sm:py-6">
        <p
          className="text-xs italic text-neutral-500 sm:text-sm"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Trin 1 af 3
        </p>
        <h2
          className="mt-1 text-lg tracking-tight text-neutral-900 sm:text-xl"
          style={{
            fontFamily: FAMBUD_FONT,
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
          }}
        >
          Hvilke brikker har I på plads?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          De fleste familier har 2-3 brikker, og tror de mangler 10.{' '}
          <strong className="font-semibold text-neutral-900">
            Sandheden er som regel den modsatte.
          </strong>
        </p>

        {/* Brikker grid - 1-col mobile, 2-col sm+. min-h-[56px] for
            touch-target. */}
        <div className="mt-4 grid gap-2.5 sm:mt-5 sm:grid-cols-2 sm:gap-3">
          {BRIKKER.map((b) => (
            <BrikCheckItem
              key={b.id}
              brik={b}
              checked={brikker.includes(b.id)}
              onToggle={() => onToggleBrik(b.id)}
            />
          ))}
        </div>

        {/* Spørgsmål: hvordan holder I styr på det i dag */}
        <div className="mt-5 sm:mt-6">
          <p
            className="text-sm italic text-neutral-900 sm:text-base"
            style={{ fontFamily: FAMBUD_FONT }}
          >
            Hvordan holder I styr på det i dag?
          </p>
          <div
            className="mt-2.5 flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Hvordan holder I styr på det i dag"
          >
            {SYSTEMS.map((s) => (
              <SystemPill
                key={s.id}
                system={s}
                selected={currentSystem === s.id}
                onSelect={() => onSelectSystem(s.id)}
              />
            ))}
          </div>
        </div>

      </div>
    </>
  );
}

// ----------------------------------------------------------------
// Brik-checkbox-card. Min-height 56px for touch-target på mobile.
// ----------------------------------------------------------------
function BrikCheckItem({
  brik,
  checked,
  onToggle,
}: {
  brik: BrikDef;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`group relative flex min-h-[56px] cursor-pointer items-start gap-3 rounded border p-3.5 transition sm:p-4 ${
        checked
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-200 bg-stone-50 text-neutral-900 hover:border-neutral-900'
      }`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={onToggle}
      />
      <span
        aria-hidden
        className={`relative mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border-[1.5px] transition ${
          checked
            ? 'border-emerald-600 bg-emerald-600'
            : 'border-neutral-900 bg-transparent'
        }`}
      >
        {checked && (
          <span className="text-[11px] font-bold leading-none text-white">
            ✓
          </span>
        )}
      </span>
      <span className="flex-1 text-left">
        <span className="block text-[15px] font-semibold leading-tight">
          {brik.title}
        </span>
        <span
          className={`mt-0.5 block text-[13px] ${
            checked ? 'text-white/70' : 'text-neutral-600'
          }`}
        >
          {brik.body}
        </span>
      </span>
    </label>
  );
}

// ----------------------------------------------------------------
// System-pill (radio-pill)
// ----------------------------------------------------------------
function SystemPill({
  system,
  selected,
  onSelect,
}: {
  system: SystemDef;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`relative cursor-pointer rounded-full border px-4 py-2.5 text-sm transition ${
        selected
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-200 bg-stone-50 text-neutral-900 hover:border-neutral-900'
      }`}
    >
      <input
        type="radio"
        name="currentSystem"
        className="sr-only"
        checked={selected}
        onChange={onSelect}
      />
      <span>{system.label}</span>
    </label>
  );
}

