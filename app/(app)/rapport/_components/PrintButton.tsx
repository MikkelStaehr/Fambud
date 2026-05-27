'use client';

// Lille klient-knap der åbner browserens print-dialog. Brugeren vælger
// "Gem som PDF" der for at få rapporten som fil til banken. Vi gør det
// bevidst via print frem for en server-genereret PDF: nul dependencies,
// fuld kontrol over layout, og print-dialogen kan både printe og gemme.
import { Printer } from 'lucide-react';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
    >
      <Printer className="h-4 w-4" />
      Gem som PDF
    </button>
  );
}
