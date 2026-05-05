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
//
// Koordinering med BetaNotice: hvis BetaNotice-modalen ikke er dismissed
// endnu i denne session, venter vi med at starte touren. Så fyrer de ikke
// oven i hinanden ved første login efter wizard.

import { useEffect, useState, useTransition } from 'react';
import { Tour, type TourStep } from './Tour';
import { completeTour } from './tour-actions';

const BETA_NOTICE_KEY = 'fambud_beta_notice_seen';

type Props = {
  tourKey: string;
  steps: TourStep[];
  // True hvis turen skal auto-starte ved mount. Pages bestemmer dette
  // server-side baseret på om brugeren har gennemført den specifikke tour.
  autoStart: boolean;
};

export function PageTour({ tourKey, steps, autoStart }: Props) {
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();

  // Auto-start: enten med det samme (hvis BetaNotice allerede er dismissed
  // eller ikke skal vises) eller når BetaNotice udsender dismiss-eventet.
  useEffect(() => {
    if (!autoStart) return;
    if (typeof window === 'undefined') return;

    const betaSeen =
      window.sessionStorage.getItem(BETA_NOTICE_KEY) === '1';
    if (betaSeen) {
      setRunning(true);
      return;
    }

    const handler = () => setRunning(true);
    window.addEventListener('fambud:beta-dismissed', handler);
    return () => window.removeEventListener('fambud:beta-dismissed', handler);
  }, [autoStart]);

  if (!running) return null;

  function handleComplete() {
    setRunning(false);
    startTransition(async () => {
      await completeTour(tourKey);
    });
  }

  return <Tour steps={steps} onComplete={handleComplete} />;
}
