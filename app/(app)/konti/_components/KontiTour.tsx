'use client';

import { PageTour } from '@/app/(app)/_components/PageTour';
import type { TourStep } from '@/app/(app)/_components/Tour';

const steps: TourStep[] = [
  {
    title: 'Konti',
    content: (
      <p>
        Her er alle jeres konti samlet ét sted - lønkonti, fælleskonti,
        opsparing og investering. Lån har sin egen side.
      </p>
    ),
  },
  {
    target: '[data-tour="konti-sections"]',
    title: 'Grupperet efter formål',
    content: (
      <>
        <p>
          Daglig brug (lønkonto, budget, husholdning), opsparing &
          investering, og evt. andet. Hver gruppe viser månedligt ind/ud-flow
          så du hurtigt ser hvad der bevæger sig.
        </p>
      </>
    ),
  },
  {
    target: '[data-tour="konti-new"]',
    title: 'Tilføj nye konti',
    content: (
      <p>
        Klik her for at oprette en ny konto. Du kan vælge type (lønkonto,
        opsparing, investering...) og evt. specialfunktion (buffer,
        forudsigelige uforudsete).
      </p>
    ),
  },
];

export function KontiTour({ autoStart }: { autoStart: boolean }) {
  return <PageTour tourKey="konti" steps={steps} autoStart={autoStart} />;
}
