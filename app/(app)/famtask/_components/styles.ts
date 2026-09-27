// Fælles Tailwind-klasser for Famtask. Status-farver følger resten af
// appen (begivenheder): neutral = ikke startet, emerald (olive) = i gang,
// amber = parkeret, blue = afsluttet.

import type { PlanProjectStatus } from '@/lib/database.types';

export const PROJECT_STATUS_CLASS: Record<PlanProjectStatus, string> = {
  ide: 'border-neutral-200 bg-neutral-100 text-neutral-700',
  aktiv: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  pause: 'border-amber-200 bg-amber-50 text-amber-800',
  faerdig: 'border-blue-200 bg-blue-50 text-blue-800',
};

// text-base på mobil (16px) så iOS ikke zoomer ind ved fokus.
export const fieldClass =
  'block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 sm:text-sm';

export const amountFieldClass =
  'block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-right font-mono tabnum text-base placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 sm:text-sm';

export const labelClass = 'mb-1 block text-xs font-medium text-neutral-600';

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-emerald-800/60';

export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50';
