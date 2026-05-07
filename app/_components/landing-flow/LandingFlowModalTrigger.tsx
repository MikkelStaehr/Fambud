'use client';

// Trigger-knap + modal-wrapper for "Find ud af det selv"-flow.
// Bruger native <dialog>-element + showModal()/close() for indbygget
// a11y: ESC-handler, focus-trap, top-layer-rendering over alt andet.
//
// State-strategi: flow-state lives HER (parent), ikke i step-komponenter.
// Det betyder at hvis brugeren lukker og åbner modalen igen i samme
// session, bevares deres svar. State nulstilles ved page reload (vi
// persisterer ikke til localStorage endnu).
//
// To-zone modal-layout:
//   ┌──────────────────────────────────┐
//   │ HEADER (zone 1 bg, sticky)       │ progress + X
//   ├──────────────────────────────────┤
//   │ ZONE 1 (warm bg-stone-100)       │ eyebrow + h1 + lead
//   │   - intro-context, kompakt       │
//   ├──────────────────────────────────┤
//   │ ZONE 2 (hvid bg)                 │ trin-content
//   │   - working area, luftig         │ + brikker + pills
//   │   - subtle inset-shadow på top   │
//   │     for "lift" fra zone 1        │
//   ├──────────────────────────────────┤
//   │ FOOTER (zone 2 bg, sticky)       │ Fortsæt-knap (step-aware)
//   └──────────────────────────────────┘
//
// Footer-indholdet varierer per step (Fortsæt → / Tilbage + Vis →
// forslag / Justér mine svar). Modal-shell rendrer det centralt så
// hver step kun behøver at rendere zone 1 + zone 2 content.

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import {
  INITIAL_FLOW_STATE,
  type Brik,
  type CurrentSystem,
  type EventTimeframe,
  type EventType,
  type FlowState,
  type UnsureField,
} from '@/lib/landing/types';
import { submitLandingFlow } from './actions';
import { StepProgress } from './StepProgress';
import { StepOne } from './StepOne';
import { StepTwo, canProceedStep2 } from './StepTwo';
import { StepThree } from './StepThree';

// localStorage-key til den anonyme conversion-token. Persisteres på
// tværs af tabs så en bruger der laver flowet, lukker tab'en og senere
// signer up fra en anden side stadig kan attribueres.
const TOKEN_STORAGE_KEY = 'fambud-landing-token';

// Hent eller generér token. crypto.randomUUID() er native på alle
// moderne browsers (Chrome 92+, Safari 15.4+, Firefox 95+) og skaber
// en uuid v4. Hvis browseren mangler det (kun gamle Edge), faldback til
// vores egen generator så vi ikke crasher.
function getOrCreateToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (existing) return existing;
    const token =
      typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-4${Math.random().toString(16).slice(2, 5)}-${Math.random().toString(16).slice(2, 6)}-${Math.random().toString(16).slice(2, 14)}`;
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    return token;
  } catch {
    // localStorage blokeret (privacy mode / disabled cookies). Vi
    // kører videre uden conversion-tracking - feature'en er nice-to-
    // have, ikke blokerende.
    return '';
  }
}

export function LandingFlowModalTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<FlowState>(INITIAL_FLOW_STATE);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Forhindrer dobbelt-submission hvis brugeren navigerer frem og
  // tilbage mellem step 2 og 3 i samme session. Token er stabil per
  // session - vi sender én gang og linker ved signup.
  const submittedRef = useRef(false);

  // Sync isOpen til dialog-element via showModal()/close().
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Body-scroll-lock når modalen er åben.
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  const close = () => setIsOpen(false);

  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      close();
    }
  };

  const handleCancel = () => setIsOpen(false);

  // Step 1 handlers
  const toggleBrik = (brik: Brik) => {
    setState((prev) => ({
      ...prev,
      brikker: prev.brikker.includes(brik)
        ? prev.brikker.filter((b) => b !== brik)
        : [...prev.brikker, brik],
    }));
  };

  const selectSystem = (system: CurrentSystem) => {
    setState((prev) => ({ ...prev, currentSystem: system }));
  };

  // Step 2 handlers
  const updateField = (
    field: 'indkomst' | 'fasteUdgifter' | 'husholdning',
    value: number | null
  ) => {
    setState((prev) => ({ ...prev, [field]: value }));
  };

  const toggleUnsure = (field: UnsureField) => {
    setState((prev) => ({
      ...prev,
      unsureFields: prev.unsureFields.includes(field)
        ? prev.unsureFields.filter((f) => f !== field)
        : [...prev.unsureFields, field],
    }));
  };

  const toggleHouseholdAtZero = () => {
    setState((prev) => ({ ...prev, householdAtZero: !prev.householdAtZero }));
  };

  // Events: 'ingen' er gensidigt eksklusiv. Vælges 'ingen' nulstilles
  // alle andre events (incl. deres budget/timeframe). Vælges et almindeligt
  // event mens 'ingen' er valgt, ryddes 'ingen' først.
  const toggleEvent = (type: EventType) => {
    setState((prev) => {
      const isSelected = prev.upcomingEvents.some((e) => e.type === type);

      if (type === 'ingen') {
        if (isSelected) {
          return { ...prev, upcomingEvents: [] };
        }
        return {
          ...prev,
          upcomingEvents: [
            { type: 'ingen', budget: null, timeframe: null },
          ],
        };
      }

      if (isSelected) {
        return {
          ...prev,
          upcomingEvents: prev.upcomingEvents.filter((e) => e.type !== type),
        };
      }

      // Tilføj nyt event, ryd 'ingen' hvis den var sat.
      const withoutIngen = prev.upcomingEvents.filter(
        (e) => e.type !== 'ingen'
      );
      return {
        ...prev,
        upcomingEvents: [
          ...withoutIngen,
          { type, budget: null, timeframe: null },
        ],
      };
    });
  };

  const updateEventBudget = (type: EventType, value: number | null) => {
    setState((prev) => ({
      ...prev,
      upcomingEvents: prev.upcomingEvents.map((e) =>
        e.type === type ? { ...e, budget: value } : e
      ),
    }));
  };

  const updateEventTimeframe = (
    type: EventType,
    timeframe: EventTimeframe
  ) => {
    setState((prev) => ({
      ...prev,
      upcomingEvents: prev.upcomingEvents.map((e) =>
        e.type === type ? { ...e, timeframe } : e
      ),
    }));
  };

  const goToStep = (step: 1 | 2 | 3) => {
    setState((prev) => {
      // Når vi rammer step 3 første gang i denne session, fyrer vi en
      // anonym conversion-tracker af. Den er fire-and-forget - hvis
      // den fejler (rate-limit, netværk, hvad som helst), fortsætter
      // brugeren upåvirket med at se sit forslag.
      if (step === 3 && !submittedRef.current) {
        submittedRef.current = true;
        const token = getOrCreateToken();
        if (token) {
          // Drop step ud af payload'en - den er en UI-state-detalje,
          // ikke en del af brugerens "svar".
          const payload = { ...prev, step: 3 };
          void submitLandingFlow(token, payload).catch((err) => {
            console.error('submitLandingFlow failed:', err);
          });
        }
      }
      return { ...prev, step };
    });
  };

  // canProceed-logik per step. Centraliseret i modal-shell så footer
  // kan disable knappen uafhængigt af step-komponenten.
  const canProceedStep1 = state.currentSystem !== null;
  const canProceedStep2Result = canProceedStep2(state);

  return (
    <>
      {/* PRIMÆR CTA i hero. Stor, grøn, fyldt knap. "Prøv det med jeres
          egne tal" er bevidst non-diagnostic - siger HVAD flowet gør
          (personaliseret med deres tal) uden at implicere at brugeren
          er fortabt. */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-800 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-emerald-700 sm:w-auto"
      >
        Prøv det med jeres egne tal
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </button>

      {/* Native <dialog>. Mobile: full-screen, ingen rounded corners.
          Desktop: centreret max-w-3xl + max-h-85vh + rounded.
          dialog-element selv har bg-transparent så vi kan style content-
          wrapperen som vil; backdrop-styling via ::backdrop.
          h-[100dvh] (dynamic viewport height) frem for h-screen (100vh)
          fordi iOS Safari's 100vh inkluderer URL-bar/toolbar - så
          footeren havner UNDER det synlige område og kan ikke scrolles
          til. dvh justerer sig som chrome'en vises/skjules. */}
      <dialog
        ref={dialogRef}
        onClick={handleDialogClick}
        onCancel={handleCancel}
        onClose={handleCancel}
        aria-labelledby="landing-flow-title"
        className="m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm sm:m-auto sm:h-auto sm:max-h-[85vh] sm:max-w-3xl sm:rounded"
      >
        {/* Content-wrapper. Layout-strategi:
            - Mobile: flex-col + h-full (= h-screen via dialog), body flex-1
              fylder mellem header og footer. Footer altid synlig.
            - Desktop: sm:h-auto + sm:max-h-[85vh] - container er kun så
              høj som content kræver, op til 85vh max. Body sm:flex-initial
              betyder den ikke voxer, kun naturlig højde.
            stopPropagation forhindrer klik-på-content i at boble til
            backdrop-handler. */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex h-full flex-col sm:h-auto sm:max-h-[85vh]"
        >
          {/* HEADER - zone 1 baggrund (warm). Sticky top. Progress dots
              venstre, X højre. shrink-0 så den ikke krymper. */}
          <header className="shrink-0 border-b border-stone-200 bg-stone-100 px-5 py-3 sm:px-8 sm:py-3.5">
            <div className="flex items-center justify-between gap-4">
              <StepProgress currentStep={state.step} />
              <button
                type="button"
                onClick={close}
                aria-label="Luk"
                className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded text-neutral-500 transition hover:bg-stone-200 hover:text-neutral-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <h2 id="landing-flow-title" className="sr-only">
            Find ud af hvor I står
          </h2>

          {/* SCROLL-AREA. Indeholder zone 1 + zone 2 fra step-component.
              Mobile: flex-1 fylder plads mellem header/footer i h-screen.
              Desktop: sm:flex-initial = body har naturlig højde, vokser
              ikke unødvendigt - modal bliver kompakt når content er kort.
              overflow-y-auto giver scroll-fallback hvis content er
              højere end max-h-[85vh] available på desktop. */}
          <div
            key={state.step}
            className="landing-flow-step flex flex-1 flex-col overflow-y-auto bg-stone-100 sm:flex-initial sm:min-h-0"
          >
            {state.step === 1 && (
              <StepOne
                brikker={state.brikker}
                currentSystem={state.currentSystem}
                onToggleBrik={toggleBrik}
                onSelectSystem={selectSystem}
              />
            )}
            {state.step === 2 && (
              <StepTwo
                indkomst={state.indkomst}
                fasteUdgifter={state.fasteUdgifter}
                husholdning={state.husholdning}
                unsureFields={state.unsureFields}
                householdAtZero={state.householdAtZero}
                upcomingEvents={state.upcomingEvents}
                onUpdateField={updateField}
                onToggleUnsure={toggleUnsure}
                onToggleHouseholdAtZero={toggleHouseholdAtZero}
                onToggleEvent={toggleEvent}
                onUpdateEventBudget={updateEventBudget}
                onUpdateEventTimeframe={updateEventTimeframe}
              />
            )}
            {state.step === 3 && <StepThree state={state} />}
          </div>

          {/* FOOTER - zone 2 baggrund (hvid). Sticky bottom. Indhold
              varierer per step. shrink-0 så den ikke krymper. */}
          <footer className="shrink-0 border-t border-neutral-200 bg-white px-5 py-3.5 sm:px-8 sm:py-4">
            <FlowFooter
              step={state.step}
              canProceedStep1={canProceedStep1}
              canProceedStep2={canProceedStep2Result}
              onGoToStep={goToStep}
            />
          </footer>
        </div>
      </dialog>
    </>
  );
}

// ----------------------------------------------------------------
// FlowFooter: knap-layout pr. step.
// - Step 1: kun "Fortsæt →" (højrestillet, ingen tilbage-knap)
// - Step 2: "← Tilbage" + "Vis vores forslag →"
// - Step 3: "← Justér mine svar" (CTA "Kom i gang gratis" lever inde
//   i step-3-content som en card-CTA, ikke i footer)
// ----------------------------------------------------------------
function FlowFooter({
  step,
  canProceedStep1,
  canProceedStep2,
  onGoToStep,
}: {
  step: 1 | 2 | 3;
  canProceedStep1: boolean;
  canProceedStep2: boolean;
  onGoToStep: (step: 1 | 2 | 3) => void;
}) {
  if (step === 1) {
    return (
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => onGoToStep(2)}
          disabled={!canProceedStep1}
          className="inline-flex items-center gap-1.5 rounded bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 disabled:hover:bg-neutral-300 sm:px-7 sm:py-3.5"
        >
          Fortsæt
          <span aria-hidden>→</span>
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onGoToStep(1)}
          className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
        >
          ← Tilbage
        </button>
        <button
          type="button"
          onClick={() => onGoToStep(3)}
          disabled={!canProceedStep2}
          className="inline-flex items-center gap-1.5 rounded bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 disabled:hover:bg-neutral-300 sm:px-7 sm:py-3.5"
        >
          Vis vores forslag
          <span aria-hidden>→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-start">
      <button
        type="button"
        onClick={() => onGoToStep(2)}
        className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
      >
        ← Justér mine svar
      </button>
    </div>
  );
}

