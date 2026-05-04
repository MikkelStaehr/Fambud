'use client';

// Generisk wrapper omkring Tour der håndterer auto-start og persistence
// pr. side. Hver page-tour har en unik tourKey (fx 'dashboard',
// 'opsparinger', 'faste-udgifter') som gemmes i family_members.tours_completed
// når brugeren klikker færdig.
//
// Brug:
//   <PageTour
//     tourKey="opsparinger"
//     steps={[...]}
//     autoStart={!hasSeenTour}
//   />
//
// hasSeenTour beregnes server-side via hasCompletedTour(key) og passes ned.

import { useState, useTransition } from 'react';
import { Tour, type TourStep } from './Tour';
import { completeTour } from './tour-actions';

type Props = {
  tourKey: string;
  steps: TourStep[];
  // True hvis turen skal auto-starte ved mount. Pages bestemmer dette
  // server-side baseret på om brugeren har gennemført den specifikke tour.
  autoStart: boolean;
};

export function PageTour({ tourKey, steps, autoStart }: Props) {
  const [running, setRunning] = useState(autoStart);
  const [, startTransition] = useTransition();

  if (!running) return null;

  function handleComplete() {
    setRunning(false);
    startTransition(async () => {
      await completeTour(tourKey);
    });
  }

  return <Tour steps={steps} onComplete={handleComplete} />;
}
