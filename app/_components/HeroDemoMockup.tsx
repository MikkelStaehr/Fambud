'use client';

// Animated hero-demo-mockup på landing page. Cykler gennem 3 måneder
// (April → Maj → Juni → April) hver 4. sekund med stagger-fade så
// elementerne skifter sekventielt frem for synkront. Maj viser bevidst
// et underskud i amber/orange så det signalerer at appen håndterer
// både gode og mindre gode måneder.
//
// Animation-stack: motion (~6KB gzipped). AnimatePresence med mode="wait"
// venter på at det gamle element fader ud før det nye fader ind, så vi
// undgår overlap. Stagger via individuelle delay-værdier (kunne også
// være staggerChildren på parent, men elementerne er fordelt på header
// + body + absolutely-positioned badge, så individual delay er klarere).
//
// Tilgængelighed:
// - useReducedMotion(): hvis OS-flag er sat, fade-varighed = 0, ingen
//   stagger, ingen interval — kortet vises som statisk frame 0.
// - IntersectionObserver: pause cykling når kortet er ude af viewport.
// - aria-live=polite på de skiftende felter.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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

// Stagger-delays. Header-elementet starter først, derefter cascader
// vi ned gennem net-amount, label, indtægter, udgifter, badge. 60ms
// mellem hvert trin føles "alive" uden at trække totalen ud over
// 0.5 sek.
const STAGGER_BASE = 0.06;
const FADE_DURATION = 0.32;
// Ease-out-quint - hurtig start, blød landing. Standard "naturlig"-
// følende kurve for entry-animationer.
const EASE = [0.16, 1, 0.3, 1] as const;

// Standard motion-config der bruges for alle skiftende elementer.
// `delay` overskrives per element for stagger-cascade.
const fadeProps = (delay: number, reduced: boolean) => ({
  initial: reduced ? false : { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: reduced ? undefined : { opacity: 0, y: -4 },
  transition: {
    duration: reduced ? 0 : FADE_DURATION,
    delay: reduced ? 0 : delay,
    ease: EASE,
  },
});

export function HeroDemoMockup() {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion() ?? false;

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
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={frame.month}
              {...fadeProps(STAGGER_BASE * 0, reducedMotion)}
              className="text-xs font-medium uppercase tracking-wider text-neutral-400"
              aria-live="polite"
            >
              {frame.month}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`net-${frameIndex}`}
              {...fadeProps(STAGGER_BASE * 1, reducedMotion)}
              className={`tabnum font-mono text-3xl font-semibold sm:text-4xl ${netColorClass}`}
              aria-live="polite"
            >
              {frame.netAmount}
            </motion.div>
          </AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`label-${frameIndex}`}
              {...fadeProps(STAGGER_BASE * 2, reducedMotion)}
              className={`mt-1 text-sm font-medium ${netColorClass}`}
            >
              {frame.netLabel}
            </motion.p>
          </AnimatePresence>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                Indtægter
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`income-${frameIndex}`}
                  {...fadeProps(STAGGER_BASE * 3, reducedMotion)}
                  className="tabnum mt-1 font-mono text-base font-semibold text-emerald-800"
                >
                  {frame.income}
                </motion.div>
              </AnimatePresence>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                Udgifter
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`expenses-${frameIndex}`}
                  {...fadeProps(STAGGER_BASE * 4, reducedMotion)}
                  className="tabnum mt-1 font-mono text-base font-semibold text-red-900"
                >
                  {frame.expenses}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Lille flydende cashflow-tjek-card. Border + shadow farve følger
          badgeAccent (emerald for OK, amber for advarsel). transition-colors
          giver en blødere skift end hård border-swap, og sker uafhængigt
          af AnimatePresence-fade på den indre tekst. */}
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
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`badge-${frameIndex}`}
            {...fadeProps(STAGGER_BASE * 5, reducedMotion)}
            className={`flex items-start gap-2 text-xs ${
              frame.badgeAccent === 'emerald' ? 'text-emerald-900' : 'text-amber-900'
            }`}
          >
            {frame.badgeIcon === 'check' ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
            )}
            {frame.badgeText}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
