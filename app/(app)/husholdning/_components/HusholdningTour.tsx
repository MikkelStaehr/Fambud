'use client';

import { PageTour } from '@/app/(app)/_components/PageTour';
import type { TourStep } from '@/app/(app)/_components/Tour';

const steps: TourStep[] = [
  {
    title: 'Husholdning',
    content: (
      <p>
        Daily-spend tracker for jeres dagligvarer og småkøb. I sætter et
        månedligt rådighedsbeløb og logger købene løbende - fremskridtet
        vises mod målet.
      </p>
    ),
  },
  {
    target: '[data-tour="husholdning-budget"]',
    title: 'Sæt månedligt rådighedsbeløb',
    content: (
      <p>
        Beløbet I gerne vil holde jer indenfor. Den grønne bar bliver
        amber når I rammer 80%, og rød ved 100%. Værdineutralt -
        forbruget er ikke "forkert", det er bare info.
      </p>
    ),
  },
  {
    target: '[data-tour="husholdning-add"]',
    title: 'Log køb løbende',
    content: (
      <p>
        Hver gang I handler ind, taster I beløb + dato + evt. beskrivelse.
        Tabellen genstarter med blank tabel hver måned, men historik
        bevares - kan ses via måneds-filter.
      </p>
    ),
  },
];

export function HusholdningTour({ autoStart }: { autoStart: boolean }) {
  return <PageTour tourKey="husholdning" steps={steps} autoStart={autoStart} />;
}
