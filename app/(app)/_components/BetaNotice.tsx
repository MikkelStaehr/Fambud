'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

// Beta-besked der vises én gang pr. session (= effektivt én gang pr. login).
// Bruger sessionStorage frem for cookie/DB så vi slipper for round-trip og
// rydder automatisk op ved tab-close. Brugeren accepterer simpelt med
// "Forstået"-knap eller X. Når test-perioden er overstået fjernes
// komponenten fra layoutet - sessionStorage-key'en kan ligge der, ingen
// gør skade.
const STORAGE_KEY = 'fambud_beta_notice_seen';

export function BetaNotice() {
  // Vi starter altid skjult og slipper først åbent når useEffect har tjekket
  // sessionStorage. Det undgår en hydration-mismatch (server-rendret HTML
  // ville ellers indeholde modallen, klienten ville fjerne den straks).
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.sessionStorage.getItem(STORAGE_KEY);
    if (!seen) setOpen(true);
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // private mode el.lign. blokerer sessionStorage - vi accepterer at
      // brugeren ser beskeden igen ved næste reload i stedet for at fejle.
    }
    // Custom event så PageTour ved den må starte. Forhindrer at en
    // dashboard-tour blinker bag BetaNotice-modalen ved første login.
    try {
      window.dispatchEvent(new Event('fambud:beta-dismissed'));
    } catch {
      // CustomEvent constructor kan kaste i meget gamle browsers
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-notice-title"
    >
      <div className="relative w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Luk besked"
          className="absolute right-3 top-3 rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900">
          <Sparkles className="h-3 w-3" />
          Tidlig version
        </span>

        <h2
          id="beta-notice-title"
          className="mt-4 text-lg font-semibold tracking-tight text-neutral-900"
        >
          Velkommen til Fambud
        </h2>

        <div className="mt-3 space-y-3 text-sm leading-relaxed text-neutral-600">
          <p>
            Tak fordi du er med så tidligt. Appen er stadig under aktiv
            udvikling - du kan støde på små fejl, manglende detaljer eller
            ændringer fra dag til dag.
          </p>
          <p>
            Driller noget eller mangler du noget? Skriv det gerne til os -
            det er præcis nu, jeres feedback har størst effekt.
          </p>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Forstået, lad os komme i gang
        </button>
      </div>
    </div>
  );
}
