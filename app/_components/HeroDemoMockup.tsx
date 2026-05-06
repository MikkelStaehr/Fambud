'use client';

// Animated hero-demo-mockup på landing page. Cykler gennem 3 måneder
// (April → Maj → Juni → April) hver 4. sekund med en blød fade-up-
// transition. Maj viser bevidst et underskud i amber/orange, så det
// signalerer at appen håndterer både gode og mindre gode måneder.
//
// Tilgængelighed:
// - prefers-reduced-motion: kun frame 0 vises statisk, ingen interval
// - IntersectionObserver: pause når kortet er ude af viewport (sparer CPU)
// - aria-live=polite på de skiftende felter så skærmlæsere annoncerer ændringer
//   uden at afbryde brugeren
//
// Animation implementeret via CSS @keyframes (globals.css :: fambud-fade-up)
// + React key-skift der force-remounter elementet og dermed replayer
// keyframen. Ingen Framer Motion - vi sparer ~50KB bundle på en simpel
// 3-state-cykling.

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Sparkles } from 'lucide-react';

type Frame = {
  month: string;
  netAmount: string;
  netLabel: string;
  netIsPositive: boolean;
  income: string;
  expenses: string;
  badgeText: string;
  badgeIcon: 'check' | 'alert';
  badgeAccent: 'emerald' | 'amber';
};

// Tre måneder. Indtægter holdes konstant (29.747,00) så ændringen i
// netto matematisk skyldes udgifterne — det illustrerer "nogle måneder
// er bare dyrere" frem for "lønnen svinger".
const FRAMES: readonly Frame[] = [
  {
    month: 'April 2026',
    netAmount: '+ 16.589,00 kr',
    netLabel: 'Du har overskud denne måned',
    netIsPositive: true,
    income: '+ 29.747,00',
    expenses: '- 13.158,00',
    badgeText: 'Alt på din side er dækket',
    badgeIcon: 'check',
    badgeAccent: 'emerald',
  },
  {
    month: 'Maj 2026',
    netAmount: '- 2.340,00 kr',
    netLabel: 'Pas på i denne måned',
    netIsPositive: false,
    income: '+ 29.747,00',
    expenses: '- 32.087,00',
    badgeText: 'Husk: bilforsikring trækkes 5. maj',
    badgeIcon: 'alert',
    badgeAccent: 'amber',
  },
  {
    month: 'Juni 2026',
    netAmount: '+ 8.420,00 kr',
    netLabel: 'Du har overskud denne måned',
    netIsPositive: true,
    income: '+ 29.747,00',
    expenses: '- 21.327,00',
    badgeText: 'Alt på din side er dækket',
    badgeIcon: 'check',
    badgeAccent: 'emerald',
  },
] as const;

const FRAME_INTERVAL_MS = 4000;

export function HeroDemoMockup() {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // prefers-reduced-motion-detect. Skifter dynamisk hvis brugeren
  // ændrer OS-indstillingen mens siden er åben.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // IntersectionObserver - pauser animationen når kortet ikke er synligt.
  // Vigtigt på lange landing-pages hvor brugeren ruller forbi hero.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.2 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Cykling. Stopper hvis reducedMotion eller kortet er ude af viewport.
  useEffect(() => {
    if (reducedMotion || !isVisible) return;
    const id = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % FRAMES.length);
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reducedMotion, isVisible]);

  const frame = FRAMES[frameIndex];

  // Brugte til React key-baseret remount så CSS animation replayer
  // ved hvert frame-skift. Konsistent suffix per element så de ikke
  // collider.
  const k = (suffix: string) => `${frameIndex}-${suffix}`;

  // Net-amount tekst-farve afhænger af om månedens netto er positiv
  // eller negativ. Vi genbruger samme palette som dashbordet bruger.
  const netColorClass = frame.netIsPositive ? 'text-emerald-800' : 'text-amber-700';

  return (
    <div ref={containerRef} className="relative">
      <div className="rounded-xl border border-neutral-200 bg-white shadow-2xl shadow-neutral-300/40">
        <div className="flex items-baseline justify-between border-b border-neutral-100 px-5 py-3">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Er du på rette spor?
          </span>
          <span
            key={k('month')}
            className="fambud-fade-up text-xs font-medium uppercase tracking-wider text-neutral-400"
            aria-live="polite"
          >
            {frame.month}
          </span>
        </div>
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <div
            key={k('net')}
            className={`fambud-fade-up tabnum font-mono text-3xl font-semibold sm:text-4xl ${netColorClass}`}
            aria-live="polite"
          >
            {frame.netAmount}
          </div>
          <p
            key={k('label')}
            className={`fambud-fade-up mt-1 text-sm font-medium ${netColorClass}`}
          >
            {frame.netLabel}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                Indtægter
              </div>
              <div
                key={k('income')}
                className="fambud-fade-up tabnum mt-1 font-mono text-base font-semibold text-emerald-800"
              >
                {frame.income}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                Udgifter
              </div>
              <div
                key={k('expenses')}
                className="fambud-fade-up tabnum mt-1 font-mono text-base font-semibold text-red-900"
              >
                {frame.expenses}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lille flydende cashflow-tjek-card. Border + shadow farve følger
          badgeAccent (emerald for OK, amber for advarsel). transition-colors
          giver en blødere skift end hård border-swap. */}
      <div
        className={`absolute -bottom-6 -right-4 hidden w-60 rounded-lg border bg-white p-4 shadow-xl transition-colors duration-300 sm:block ${
          frame.badgeAccent === 'emerald'
            ? 'border-emerald-200 shadow-emerald-900/10'
            : 'border-amber-200 shadow-amber-900/10'
        }`}
      >
        <div
          className={`mb-2 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${
            frame.badgeAccent === 'emerald' ? 'text-emerald-700' : 'text-amber-700'
          }`}
        >
          <Sparkles className="h-3 w-3" />
          Cashflow-tjek
        </div>
        <div
          key={k('badge')}
          className={`fambud-fade-up flex items-start gap-2 text-xs ${
            frame.badgeAccent === 'emerald' ? 'text-emerald-900' : 'text-amber-900'
          }`}
        >
          {frame.badgeIcon === 'check' ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
          )}
          {frame.badgeText}
        </div>
      </div>
    </div>
  );
}
