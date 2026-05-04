'use client';

import { PageTour } from '@/app/(app)/_components/PageTour';
import type { TourStep } from '@/app/(app)/_components/Tour';

const steps: TourStep[] = [
  {
    title: 'Overførsler',
    content: (
      <p>
        Penge der flyttes mellem jeres konti hver måned - typisk fra
        lønkonto til fælles budgetkonto, husholdning og opsparing.
        Rygraden i jeres månedlige cashflow.
      </p>
    ),
  },
  {
    target: '[data-tour="overforsler-list"]',
    title: 'Recurring overførsler',
    content: (
      <p>
        Hver række er en månedlig overførsel mellem to konti. Klik for at
        redigere beløb eller dato. Cashflow-grafen på dashboardet bygger
        på disse.
      </p>
    ),
  },
  {
    target: '[data-tour="overforsler-add"]',
    title: 'Opret ny overførsel',
    content: (
      <p>
        Lav en ny recurring overførsel - vælg fra-konto, til-konto, beløb
        og frekvens. Cashflow-tjekket på dashboardet linker direkte hertil
        med pre-fyldte felter når noget mangler.
      </p>
    ),
  },
];

export function OverforslerTour({ autoStart }: { autoStart: boolean }) {
  return <PageTour tourKey="overforsler" steps={steps} autoStart={autoStart} />;
}
