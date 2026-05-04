'use client';

// Interaktiv guided tour for dashboardet. Viser et spotlight på et
// element + tooltip med forklaring, Næste/Forrige/Spring over-knapper.
// Bygget custom (uden bibliotek) for at have fuld kontrol over UX -
// målgruppen er ikke-tekniske familier og det skal være krystalklart.
//
// Spotlight bruger box-shadow-tricket: én div positioneret over target,
// med kæmpe shadow-spread der dimmer alt udenfor cutoutet. Target-elementet
// er stadig synligt og kan klikkes igennem.
//
// Steps der ikke har et target rendres som centrerede modaler (velkomst,
// færdig). Resten har spotlight + tooltip ved siden af.
//
// Re-positionering ved scroll/resize sikrer at spotlight følger hvis
// brugeren skifter zoom eller siden re-flower.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

export type TourStep = {
  // CSS-selector til element der skal highlightes. Hvis omitted → modal-step
  // (centreret popup uden spotlight, til velkomst/færdig).
  target?: string;
  title: string;
  content: React.ReactNode;
};

type Props = {
  steps: TourStep[];
  // Kaldes når brugeren afslutter eller springer over.
  onComplete: () => void;
};

const PADDING = 8; // afstand mellem target og spotlight-kant
const TOOLTIP_OFFSET = 16; // afstand mellem spotlight og tooltip

export function Tour({ steps, onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tick, setTick] = useState(0); // tvinger re-render ved scroll/resize
  const [mounted, setMounted] = useState(false);

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  // Portal'en kræver document.body som først er tilgængeligt efter mount.
  useEffect(() => setMounted(true), []);

  // Find target rect, scroll det i view, og hold rect opdateret ved scroll/resize.
  // Hvis target ikke findes (fx OnboardingChecklist der har skjult sig selv),
  // auto-springer vi til næste trin efter et kort delay - i stedet for at vise
  // en forvirrende "vi kunne ikke finde det"-modal.
  useEffect(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    let cancelled = false;
    // Vent kort på at elementet evt. bliver rendret (async layout, hydration)
    // før vi giver op og springer over.
    function findOrSkip() {
      if (cancelled) return;
      const el = document.querySelector(step.target!);
      if (!el) {
        // Auto-skip - usynligt for brugeren, går direkte til næste step
        if (isLast) onComplete();
        else setIndex((i) => i + 1);
        return;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Lille delay så scrollIntoView har tid til at lande før vi måler
      setTimeout(() => {
        if (cancelled) return;
        const elNow = document.querySelector(step.target!);
        if (elNow) setRect(elNow.getBoundingClientRect());
      }, 350);
    }
    findOrSkip();

    function tickUpdate() {
      setTick((t) => t + 1);
    }
    window.addEventListener('resize', tickUpdate);
    window.addEventListener('scroll', tickUpdate, true);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', tickUpdate);
      window.removeEventListener('scroll', tickUpdate, true);
    };
  }, [step?.target, index, isLast, onComplete]);

  // Re-mål når tick ændrer sig (scroll/resize)
  useEffect(() => {
    if (!step?.target) return;
    const el = document.querySelector(step.target);
    if (el) setRect(el.getBoundingClientRect());
  }, [tick, step?.target]);

  // ESC for at springe over
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onComplete();
      else if (e.key === 'ArrowRight') {
        if (isLast) onComplete();
        else setIndex((i) => i + 1);
      } else if (e.key === 'ArrowLeft' && !isFirst) {
        setIndex((i) => i - 1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFirst, isLast, onComplete]);

  if (!mounted || !step) return null;

  function next() {
    if (isLast) onComplete();
    else setIndex(index + 1);
  }
  function back() {
    if (!isFirst) setIndex(index - 1);
  }

  // Modal-step (ingen target) - centreret popup
  if (!step.target) {
    return createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="absolute inset-0 bg-neutral-900/70"
          onClick={onComplete}
          aria-hidden="true"
        />
        <div className="relative w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-2xl">
          <button
            type="button"
            onClick={onComplete}
            className="absolute right-3 top-3 rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Spring over"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="text-lg font-semibold text-neutral-900">
            {step.title}
          </h3>
          <div className="mt-3 text-sm leading-relaxed text-neutral-700">
            {step.content}
          </div>
          <TourFooter
            index={index}
            total={steps.length}
            isFirst={isFirst}
            isLast={isLast}
            onBack={back}
            onNext={next}
            onSkip={onComplete}
          />
        </div>
      </div>,
      document.body
    );
  }

  // Spotlight-step - hvis rect endnu ikke er målt (fx scrollIntoView ikke
  // landet endnu), render intet. useEffect auto-springer hvis target slet
  // ikke findes, så denne tilstand er kort.
  if (!rect) return null;

  // Bestem hvor tooltip skal placeres relativt til target
  const placement = decidePlacement(rect);

  return createPortal(
    <div className="fixed inset-0 z-[100]" aria-hidden="false">
      {/* Spotlight cutout via box-shadow trick */}
      <div
        className="pointer-events-none fixed rounded-md transition-all duration-200"
        style={{
          top: rect.top - PADDING,
          left: rect.left - PADDING,
          width: rect.width + PADDING * 2,
          height: rect.height + PADDING * 2,
          boxShadow:
            '0 0 0 9999px rgba(23, 23, 23, 0.7), 0 0 0 3px rgba(16, 185, 129, 0.9)',
        }}
      />

      {/* Klik-fanger over hele skærmen, så klik UDENFOR tooltip og target
          ikke gør noget. Tooltip og target er klikbare ovenpå. */}
      <div className="absolute inset-0" />

      <TourTooltipBox
        rect={rect}
        placement={placement}
        step={step}
        index={index}
        total={steps.length}
        isFirst={isFirst}
        isLast={isLast}
        onBack={back}
        onNext={next}
        onSkip={onComplete}
      />
    </div>,
    document.body
  );
}

type Placement = 'top' | 'bottom' | 'left' | 'right';

// Antal pixels vi forventer tooltip optager - generøst estimat så vi
// ikke vælger en placement der ikke kan rumme den fulde tooltip.
const TIP_W_EST = 320;
const TIP_H_EST = 320;

function decidePlacement(rect: DOMRect): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 16;
  const spaceBelow = vh - rect.bottom - margin;
  const spaceAbove = rect.top - margin;
  const spaceLeft = rect.left - margin;
  const spaceRight = vw - rect.right - margin;

  // Foretræk vertikal placering (under, så over). Skift til siden kun
  // hvis tooltip ALDRIG kan fitte vertikalt - så vi undgår at tooltip
  // overlapper det vi prøver at highlighte.
  if (spaceBelow >= TIP_H_EST) return 'bottom';
  if (spaceAbove >= TIP_H_EST) return 'top';
  if (spaceRight >= TIP_W_EST) return 'right';
  if (spaceLeft >= TIP_W_EST) return 'left';

  // Ingen placement kan rumme den fulde tooltip - vælg den med mest plads
  // og lad clamping i TourTooltipBox sørge for at den ikke går ud over
  // skærmen (kan resultere i at tooltip overlapper target lidt - accepteret
  // som sidste udvej).
  return spaceBelow > spaceAbove ? 'bottom' : 'top';
}

function TourTooltipBox({
  rect,
  placement,
  step,
  index,
  total,
  isFirst,
  isLast,
  onBack,
  onNext,
  onSkip,
}: {
  rect: DOMRect;
  placement: Placement;
  step: TourStep;
  index: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipSize, setTipSize] = useState({ w: 320, h: 200 });

  useEffect(() => {
    if (tipRef.current) {
      setTipSize({
        w: tipRef.current.offsetWidth,
        h: tipRef.current.offsetHeight,
      });
    }
  }, [step.title, step.content]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Beregn position
  let top = 0;
  let left = 0;
  switch (placement) {
    case 'bottom':
      top = rect.bottom + TOOLTIP_OFFSET + PADDING;
      left = rect.left + rect.width / 2 - tipSize.w / 2;
      break;
    case 'top':
      top = rect.top - tipSize.h - TOOLTIP_OFFSET - PADDING;
      left = rect.left + rect.width / 2 - tipSize.w / 2;
      break;
    case 'right':
      top = rect.top + rect.height / 2 - tipSize.h / 2;
      left = rect.right + TOOLTIP_OFFSET + PADDING;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - tipSize.h / 2;
      left = rect.left - tipSize.w - TOOLTIP_OFFSET - PADDING;
      break;
  }
  // Klamp både horisontalt og vertikalt så tooltip ikke går ud over
  // viewport. Vertikal clamping er især vigtigt for sidebar-targets
  // hvor tooltip centreres på et højt element.
  const margin = 12;
  if (left < margin) left = margin;
  if (left + tipSize.w > vw - margin) left = vw - margin - tipSize.w;
  if (top < margin) top = margin;
  if (top + tipSize.h > vh - margin) top = vh - margin - tipSize.h;

  return (
    <div
      ref={tipRef}
      className="absolute z-10 w-80 rounded-lg border border-neutral-200 bg-white p-5 shadow-2xl"
      style={{ top, left }}
      role="dialog"
      aria-modal="true"
    >
      <h3 className="text-base font-semibold text-neutral-900">
        {step.title}
      </h3>
      <div className="mt-2 text-sm leading-relaxed text-neutral-700">
        {step.content}
      </div>
      <TourFooter
        index={index}
        total={total}
        isFirst={isFirst}
        isLast={isLast}
        onBack={onBack}
        onNext={onNext}
        onSkip={onSkip}
      />
    </div>
  );
}

function TourFooter({
  index,
  total,
  isFirst,
  isLast,
  onBack,
  onNext,
  onSkip,
}: {
  index: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-400">
          {index + 1} af {total}
        </span>
        {!isLast && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            Spring over
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!isFirst && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Forrige
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          {isLast ? 'Kom i gang' : 'Næste'}
          {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
