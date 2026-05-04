'use client';

import { PageTour } from '@/app/(app)/_components/PageTour';
import type { TourStep } from '@/app/(app)/_components/Tour';

const steps: TourStep[] = [
  {
    title: 'Faste udgifter',
    content: (
      <p>
        Tilføj jeres faste regninger - husleje, abonnementer, forsikringer
        - pr. konto. Hver konto-card viser totalen for den specifikke
        konto.
      </p>
    ),
  },
  {
    target: '[data-tour="faste-udgifter-cards"]',
    title: 'Klik en konto for at redigere',
    content: (
      <p>
        På detail-siden tilføjer, ændrer eller sletter du udgifter. I kan
        skifte mellem konti via tabs øverst på detail-siden uden at gå
        tilbage hertil.
      </p>
    ),
  },
];

export function FasteUdgifterTour({ autoStart }: { autoStart: boolean }) {
  return <PageTour tourKey="faste-udgifter" steps={steps} autoStart={autoStart} />;
}
