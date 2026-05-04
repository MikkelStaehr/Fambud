'use client';

import { PageTour } from '@/app/(app)/_components/PageTour';
import type { TourStep } from '@/app/(app)/_components/Tour';

const steps: TourStep[] = [
  {
    title: 'Budget',
    content: (
      <p>
        Flad oversigt over alle jeres faste udgifter på tværs af konti -
        husleje, abonnementer, forsikringer. Til at se "hvad har vi
        liggende" i én tabel uden at klikke ind på hver konto.
      </p>
    ),
  },
  {
    target: '[data-tour="budget-table"]',
    title: 'Hver række = én udgift',
    content: (
      <p>
        Sorter efter konto, gruppe eller interval. Klik på en række for
        at gå til detail-siden hvor du kan redigere beløb, dato eller
        kategori.
      </p>
    ),
  },
];

export function BudgetTour({ autoStart }: { autoStart: boolean }) {
  return <PageTour tourKey="budget" steps={steps} autoStart={autoStart} />;
}
