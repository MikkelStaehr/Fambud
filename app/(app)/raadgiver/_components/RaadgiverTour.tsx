'use client';

import { PageTour } from '@/app/(app)/_components/PageTour';
import type { TourStep } from '@/app/(app)/_components/Tour';

const steps: TourStep[] = [
  {
    title: 'Rådgiveren',
    content: (
      <p>
        Her analyserer vi det I har indtastet - indkomst, udgifter, lån - og
        foreslår en konkret opsætning. Alt regnes ud fra jeres egne tal, ikke
        generiske råd.
      </p>
    ),
  },
  {
    target: '[data-tour="raadgiver-mangler"]',
    title: 'Manglende opsætning',
    content: (
      <p>
        Først peger vi på huller der gør rådgivningen mere præcis - fx hvis du
        mangler at registrere løn, eller en partner mangler at komme med. Dine
        egne huller får en knap, så du kan ordne dem med det samme.
      </p>
    ),
  },
  {
    target: '[data-tour="raadgiver-fordeling"]',
    title: 'Fordeling af fælles udgifter',
    content: (
      <p>
        Skift mellem tre modeller - proportional, 50/50 og udlignet rådighed -
        og se hvad hver af jer har tilbage til sig selv bagefter. Et godt
        udgangspunkt for en snak om hvordan I deler.
      </p>
    ),
  },
  {
    target: '[data-tour="raadgiver-optimering"]',
    title: 'Buffer, overskud, budget og lån',
    content: (
      <p>
        Længere nede: en buffer-anbefaling, forslag til hvordan du fordeler dit
        overskud, en 50/30/20-budgetmodel, og låneoptimering der viser hvad
        ekstra afdrag konkret sparer dig.
      </p>
    ),
  },
];

export function RaadgiverTour({ autoStart }: { autoStart: boolean }) {
  return <PageTour tourKey="raadgiver" steps={steps} autoStart={autoStart} />;
}
