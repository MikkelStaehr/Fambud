'use client';

import { PageTour } from '@/app/(app)/_components/PageTour';
import type { TourStep } from '@/app/(app)/_components/Tour';

const steps: TourStep[] = [
  {
    title: 'Indkomst',
    content: (
      <p>
        Hvor pengene kommer fra - hovedindkomst (løn/understøttelse) pr.
        person, og biindkomst (freelance, B-skat, udbytte). Forecast
        beregnes løbende ud fra de seneste 3 lønudbetalinger.
      </p>
    ),
  },
  {
    target: '[data-tour="indkomst-hovedindkomst"]',
    title: 'Hovedindkomst pr. person',
    content: (
      <>
        <p>
          Hver voksen i husstanden har sit eget kort her. Vi viser kilde
          (løn vs. understøttelse), forecast-status (3/3 udbetalinger?) og
          historik af registrerede paychecks.
        </p>
        <p className="mt-2">
          Klik <strong>"Registrer lønudbetaling"</strong> for at tilføje
          en ny - eller brug Duplikér på en eksisterende.
        </p>
      </>
    ),
  },
  {
    target: '[data-tour="indkomst-biindkomst"]',
    title: 'Biindkomst',
    content: (
      <p>
        Alt der ikke er hovedindkomst - freelance-fakturaer, B-skat,
        udbytter, lejeindtægter. Kan være enkelt-betalinger eller
        recurring (fx månedlig udlejning).
      </p>
    ),
  },
];

export function IndkomstTour({ autoStart }: { autoStart: boolean }) {
  return <PageTour tourKey="indkomst" steps={steps} autoStart={autoStart} />;
}
