// Genbrugelig empty-state til lister og oversigter. Tre forskellige stilarter
// var i brug rundt om i appen før dette blev introduceret - auditten i
// DEVLOG.md (28. apr-pass) identificerede dem som "Stil A/B/C". Dette er
// kanonen: dashed border, centreret tekst, valgfri CTA-knap eller -link.
//
// Brug:
//   <EmptyState message="Ingen konti endnu" cta={{ href: '/konti/ny', label: 'Ny konto' }} />
//
//   <EmptyState
//     message="Ingen poster i denne måned. Tilføj din første nedenfor."
//     compact
//   />

import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  message: ReactNode;
  cta?: { href: string; label: string };
  // compact = mindre vertical padding (bruges i tabel-vis tomme lister hvor
  // der ikke skal være masser af luft).
  compact?: boolean;
};

export function EmptyState({ message, cta, compact = false }: Props) {
  return (
    <div
      className={`rounded-md border border-dashed border-neutral-200 bg-white px-6 text-center ${
        compact ? 'py-6' : 'py-12'
      }`}
    >
      <p className="text-sm text-neutral-500">{message}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          {cta.label}
        </Link>
      )}
    </div>
  );
}
