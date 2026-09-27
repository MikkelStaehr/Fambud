'use client';

// "Ny spark"-knap: åbner samme quick-capture som Cmd/Ctrl+K. Nødvendig på
// mobil hvor der ikke er et tastatur. Genvejs-hint vises kun fra sm og op.

import { useSyncExternalStore } from 'react';
import { Sparkles } from 'lucide-react';
import { isMacPlatform, openQuickCapture } from '../../_components/QuickCapture';

const noopSubscribe = () => () => {};

export function CaptureButton() {
  // null under SSR/hydration, så server og klient render'er ens.
  const isMac = useSyncExternalStore(noopSubscribe, isMacPlatform, () => null);

  return (
    <button
      type="button"
      onClick={openQuickCapture}
      className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
    >
      <Sparkles className="h-4 w-4" />
      Ny spark
      {isMac !== null && (
        <kbd className="ml-1 hidden rounded bg-white/15 px-1.5 py-0.5 font-sans text-[11px] font-medium sm:inline">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      )}
    </button>
  );
}
