'use client';

import { PageTour } from '@/app/(app)/_components/PageTour';
import type { TourStep } from '@/app/(app)/_components/Tour';

const steps: TourStep[] = [
  {
    title: 'Lån',
    content: (
      <p>
        Overblik over al gæld - kreditkort, banklån, realkredit. Hver
        post viser saldo, rente og månedlig ydelse, så du kan sammenligne
        på tværs.
      </p>
    ),
  },
  {
    target: '[data-tour="laan-list"]',
    title: 'Hvert lån i én række',
    content: (
      <>
        <p>
          Klik på et lån for at se den fulde amortisering: hvor meget af
          ydelsen går til afdrag vs. rente, og hvor lang tid det tager
          før lånet er væk.
        </p>
      </>
    ),
  },
  {
    target: '[data-tour="laan-new"]',
    title: 'Tilføj et lån',
    content: (
      <p>
        Opret nye lån her. Vi støtter både simple kreditkort og fuld
        realkredit-amortisering med rente, bidrag og rabat.
      </p>
    ),
  },
];

export function LaanTour({ autoStart }: { autoStart: boolean }) {
  return <PageTour tourKey="laan" steps={steps} autoStart={autoStart} />;
}
