// Vises automatisk af Next.js mens en (app)-side server-renderer.
// Erstatter den 0,5-2s blanke pause hvor brugeren ikke ved om klikket
// var registreret. Holder sidebaren synlig via parent layout - kun
// main-content-arealet får loading-state.
//
// Vi bruger en simpel skeleton frem for spinner: matcher det visuelle
// layout brugeren forventer på næste side, så page-skiftet føles som
// indhold-streamer-ind frem for siden-genindlæses.

import { Loader2 } from 'lucide-react';

export default function AppLoading() {
  return (
    <div className="flex h-full items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-sm text-neutral-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Indlæser...</span>
      </div>
    </div>
  );
}
