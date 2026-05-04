'use client';

// Soft onboarding-affordance: et lille ?-ikon der viser en kort forklaring
// ved hover (desktop) eller tap (mobile/touch). Ikke-tvungent - nye brugere
// kan klikke for forklaring, erfarne ignorerer ikonet helt.
//
// Brug:
//   <InfoTooltip>
//     Tekst der forklarer hvad denne sektion gør og hvorfor den findes.
//   </InfoTooltip>
//
// Tooltip-positionering er auto via Tailwind absolute + max-w. Ved
// hjørner kan position-prop'en justere placeringen.

import { useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

type Position = 'top' | 'bottom' | 'left' | 'right';

type Props = {
  children: React.ReactNode;
  position?: Position;
  // Label til screen-readers + tooltip's overskrift hvis sat. Default
  // er en generisk "Mere info"-tekst.
  label?: string;
  // Inline ikon-størrelse. Default er small (h-3.5).
  size?: 'sm' | 'md';
};

export function InfoTooltip({
  children,
  position = 'bottom',
  label = 'Mere info',
  size = 'sm',
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  // Klik udenfor lukker tooltipet (vigtig for tap-baseret åbning på mobile)
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const iconSize = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';

  // Tooltip position-klasser. Bruger pil-trekanten skifter også retning.
  const positionClasses: Record<Position, string> = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label={label}
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-full text-neutral-300 transition hover:text-emerald-700 focus:text-emerald-700 focus:outline-none"
      >
        <HelpCircle className={iconSize} />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute z-20 w-64 rounded-md border border-neutral-200 bg-white p-3 text-left text-xs leading-relaxed text-neutral-700 shadow-lg ${positionClasses[position]}`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
