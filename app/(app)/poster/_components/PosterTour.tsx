'use client';

import { PageTour } from '@/app/(app)/_components/PageTour';
import type { TourStep } from '@/app/(app)/_components/Tour';

const steps: TourStep[] = [
  {
    title: 'Poster',
    content: (
      <p>
        Alle transaktioner i husstanden - både recurring (faste regninger)
        og enkelt-betalinger. Søg, filtrer og sortér når I skal finde en
        bestemt post.
      </p>
    ),
  },
  {
    target: '[data-tour="poster-filters"]',
    title: 'Filter på det vigtige',
    content: (
      <p>
        Snæver listen ned på måned, kategori, konto eller beløbsstørrelse.
        Praktisk når I leder efter en konkret udgift eller vil se
        kategori-fordeling.
      </p>
    ),
  },
  {
    target: '[data-tour="poster-add"]',
    title: 'Tilføj ny post',
    content: (
      <p>
        Engangs-betalinger, kontante udlæg, refunderinger - alt der ikke
        er en recurring fast udgift hører til her.
      </p>
    ),
  },
];

export function PosterTour({ autoStart }: { autoStart: boolean }) {
  return <PageTour tourKey="poster" steps={steps} autoStart={autoStart} />;
}
