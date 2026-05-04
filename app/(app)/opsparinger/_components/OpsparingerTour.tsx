'use client';

import { PageTour } from '@/app/(app)/_components/PageTour';
import type { TourStep } from '@/app/(app)/_components/Tour';

const steps: TourStep[] = [
  {
    title: 'Opsparinger & buffer',
    content: (
      <p>
        Tredje del af "budget-treenigheden": faste udgifter, husholdning
        og opsparing. Her er alt I lægger til side hver måned.
      </p>
    ),
  },
  {
    target: '[data-tour="opsparinger-recommended"]',
    title: 'Anbefalede opsparinger',
    content: (
      <>
        <p>
          To opsparinger vi aktivt foreslår at I prioriterer:
        </p>
        <ul className="mt-2 ml-4 list-disc">
          <li>
            <strong>Buffer</strong> - nødfond til jobtab, sygdom, akut
            reparation. Tommelfinger: 3 mdr af jeres faste udgifter.
          </li>
          <li>
            <strong>Forudsigelige uforudsete</strong> - tandlæge, gaver,
            bilvedligehold. Pulje I bygger op løbende.
          </li>
        </ul>
        <p className="mt-2 text-xs text-neutral-500">
          Beregnet ud fra jeres egne tal, ikke en abstrakt %-regel.
        </p>
      </>
    ),
  },
  {
    target: '[data-tour="opsparinger-all"]',
    title: 'Alle jeres opsparingskonti',
    content: (
      <p>
        Aldersopsparing, aktiesparekonto, ferie, børneopsparing. Hver
        konto viser månedligt indskud - "Mangler overførsel" markeres
        med amber hvis der ikke kommer noget ind.
      </p>
    ),
  },
];

export function OpsparingerTour({ autoStart }: { autoStart: boolean }) {
  return <PageTour tourKey="opsparinger" steps={steps} autoStart={autoStart} />;
}
