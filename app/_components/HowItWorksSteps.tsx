'use client';

// "Sådan kommer du i gang"-sektionen som vertikal timeline med 4 trin.
// Hver trin har et nummereret badge, tekst og en lille app-mockup.
//
// Mobile-first:
// - Mobile (<sm): badge + tekst i 2-kolonne grid, mockup stacked under
//   med fuld bredde
// - Desktop (sm+): badge + tekst + mockup i 3-kolonne grid på samme
//   række
//
// Animation: hver trin fader op og 16px Y når det rammer viewport.
// 150ms stagger via index × delay. useInView med once: true så vi
// ikke re-trigger ved scroll-up. Respekter useReducedMotion.
//
// Vertikal forbindelseslinje mellem badges renderes som en absolute-
// positioned div i hver step's relative wrapper. Sidste step har
// ingen linje.

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView, useReducedMotion } from 'motion/react';

const FADE_DURATION = 0.55;
const LINE_DURATION = 0.5;
const STAGGER = 0.15;
const EASE = [0.16, 1, 0.3, 1] as const;
// amount: 0.15 fyrer animationen så snart 15% af elementet er i viewport.
// Lavere end 0.3 fordi steps er høje (især med mockups på desktop), og vi
// vil have at animationen starter når brugeren først får øje på elementet.
const VIEWPORT_OPTIONS = { once: true, amount: 0.15 } as const;

export function HowItWorksSteps() {
  return (
    <section className="border-y border-neutral-200 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">
            Sådan kommer du i gang
          </p>
          <h2
            className="mt-2 text-3xl tracking-tight text-neutral-900 sm:text-4xl"
            style={{ fontFamily: 'var(--font-zt-nature), system-ui, sans-serif' }}
          >
            Du er kørende på 10 minutter
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-neutral-600">
            Du behøver ikke have alt klar fra starten. Begynd med din løn og
            dine største faste udgifter, så bygger du resten på når det
            passer dig.
          </p>
        </div>

        <div className="mt-12 sm:mt-16">
          <Step
            n={1}
            title="Opret konto"
            body="Email og adgangskode. Det er det. Ingen adresse, ingen CPR, ingen bankoplysninger."
            mockup={<SignupMockup />}
          />
          <Step
            n={2}
            title="Tilføj din løn"
            body="Tre lønudbetalinger fra de sidste måneder. Fambud regner et forecast der fanger overtid, ferietillæg og bonus."
            mockup={<PaychecksMockup />}
          />
          <Step
            n={3}
            title="Læg dine faste udgifter ind"
            body="Husleje eller realkreditlån, forsikringer, abonnementer, daginstitution. Det meste kan du finde på dit kontoudtog."
            mockup={<ExpensesMockup />}
          />
          <Step
            n={4}
            title="Se månederne foran dig"
            body="Fambud viser dig hvordan de næste måneder kommer til at se ud. Hvor du er dækket, hvor du skal passe på, og hvor der er plads til at spare op."
            mockup={<ForecastMockup />}
            isLast
          />
        </div>

        <CtaBlock />
      </div>
    </section>
  );
}

// ----------------------------------------------------------------
// Timeline-trin
// ----------------------------------------------------------------
function Step({
  n,
  title,
  body,
  mockup,
  isLast = false,
}: {
  n: number;
  title: string;
  body: string;
  mockup: React.ReactNode;
  isLast?: boolean;
}) {
  const reducedMotion = useReducedMotion() ?? false;

  // Eksplicit useInView via ref. whileInView som vi havde før kunne
  // i nogle viewport-kombinationer fyre uden at give synlig animation
  // (især hvis brugeren rammer sektion direkte fra anchor-link). Med
  // ref-baseret useInView har vi fuld kontrol og kan også reuse'e
  // staten til connector-line-animation.
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, VIEWPORT_OPTIONS);

  // Hvis reducedMotion ELLER elementet er i viewport, vis i sin endelige
  // synlige tilstand. Ellers initial-skjult med 24px Y-offset.
  const stepDelay = (n - 1) * STAGGER;
  const lineDelay = stepDelay + 0.18; // line vokser ind lige efter step lander

  return (
    <motion.div
      ref={ref}
      initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      animate={
        isInView || reducedMotion
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: 24 }
      }
      transition={{
        duration: reducedMotion ? 0 : FADE_DURATION,
        delay: reducedMotion ? 0 : stepDelay,
        ease: EASE,
      }}
      // Mobile (<sm): 2-kolonne grid (badge | tekst), mockup på row 2
      // sm+: 3-kolonne grid (badge | tekst | mockup) på én row
      className={`relative grid grid-cols-[40px_1fr] gap-x-4 sm:grid-cols-[40px_1fr_minmax(0,260px)] sm:gap-x-6 ${
        isLast ? '' : 'pb-10 sm:pb-12'
      }`}
    >
      {/* Vertikal forbindelseslinje. Animeres med scaleY 0->1 fra top
          så den "vokser ned" fra badge til næste trin. transform-origin
          top sikrer at den ikke vokser begge veje. Delay synced så
          linjen kommer ind LIGE efter step-content lander. */}
      {!isLast && (
        <motion.div
          className="absolute left-5 top-10 bottom-0 w-0.5 origin-top -translate-x-1/2 bg-emerald-200"
          initial={reducedMotion ? { scaleY: 1 } : { scaleY: 0 }}
          animate={
            isInView || reducedMotion ? { scaleY: 1 } : { scaleY: 0 }
          }
          transition={{
            duration: reducedMotion ? 0 : LINE_DURATION,
            delay: reducedMotion ? 0 : lineDelay,
            ease: EASE,
          }}
          aria-hidden
        />
      )}

      {/* Badge */}
      <div className="relative z-10">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700 font-mono text-sm font-semibold text-white tabular-nums"
          aria-label={`Trin ${n}`}
        >
          {n}
        </div>
      </div>

      {/* Tekst */}
      <div className="min-w-0">
        <h3 className="text-lg font-semibold tracking-tight text-neutral-900">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 sm:text-base">
          {body}
        </p>
      </div>

      {/* Mockup. På mobile: row 2, span begge kolonner, top-margin.
          På sm+: kolonne 3, samme row som tekst. */}
      <div className="col-span-2 mt-5 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0">
        {mockup}
      </div>
    </motion.div>
  );
}

// ----------------------------------------------------------------
// Mockup 1: Signup-form
// ----------------------------------------------------------------
function SignupMockup() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <MockField label="Email" />
        <MockField label="Adgangskode" />
        <button
          type="button"
          tabIndex={-1}
          className="mt-1 w-full rounded-md bg-emerald-700 py-2 text-xs font-semibold text-white"
        >
          Opret konto
        </button>
      </div>
    </div>
  );
}

function MockField({ label }: { label: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className="h-8 rounded-md border border-neutral-200 bg-neutral-50" />
    </div>
  );
}

// ----------------------------------------------------------------
// Mockup 2: Lønudbetalinger-liste
// ----------------------------------------------------------------
function PaychecksMockup() {
  const rows = [
    { month: 'Februar', amount: '28.450 kr' },
    { month: 'Marts', amount: '29.120 kr' },
    { month: 'April', amount: '28.890 kr' },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
        Lønudbetalinger
      </div>
      <ul className="divide-y divide-neutral-100">
        {rows.map((r) => (
          <li
            key={r.month}
            className="flex items-center justify-between px-3 py-2.5 text-sm"
          >
            <span className="text-neutral-700">{r.month}</span>
            <span className="tabnum font-mono text-emerald-800">{r.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------------
// Mockup 3: Faste udgifter-liste
// ----------------------------------------------------------------
function ExpensesMockup() {
  const rows = [
    { label: 'Realkredit', amount: '8.490 kr', color: '#7c3aed' },
    { label: 'Forsikringer', amount: '2.140 kr', color: '#0891b2' },
    { label: 'Daginstitution', amount: '3.580 kr', color: '#ea580c' },
    { label: 'Abonnementer', amount: '890 kr', color: '#16a34a' },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
        Faste udgifter
      </div>
      <ul className="divide-y divide-neutral-100">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <span className="inline-flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: r.color }}
                aria-hidden
              />
              <span className="text-neutral-700">{r.label}</span>
            </span>
            <span className="tabnum font-mono text-neutral-700">{r.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------------
// Mockup 4: Forecast bar-chart
// ----------------------------------------------------------------
function ForecastMockup() {
  // Heights er procent-baserede. Juni er amber (advarsel) som signaler
  // "pas på i denne måned" - matcher samme amber-pattern som
  // HeroDemoMockup's underskuds-frame.
  //
  // Tidligere version brugte nested flex-col med flex-1, hvilket gav
  // ingen pixel-context for height: % beregning - bars renderede med
  // 0px højde. Nu bruger vi grid-cols-5 + items-end så hver bar har en
  // klar parent-højde at regne mod.
  const months = [
    { label: 'Maj', heightPct: 65, fill: 'bg-emerald-600' },
    { label: 'Juni', heightPct: 30, fill: 'bg-amber-500' },
    { label: 'Juli', heightPct: 85, fill: 'bg-emerald-600' },
    { label: 'Aug', heightPct: 75, fill: 'bg-emerald-600' },
    { label: 'Sep', heightPct: 50, fill: 'bg-emerald-600' },
  ];
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="mb-3 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
        Forecast
      </div>
      {/* Bars: 5-kolonne grid med fast container-højde (h-24 = 96px) +
          items-end for at justere bars til bunden. Inde i hver kolonne
          har bar w-full + height i pct af de 96px. */}
      <div className="grid h-24 grid-cols-5 items-end gap-2">
        {months.map((m) => (
          <div
            key={m.label}
            className={`w-full rounded-t-sm ${m.fill}`}
            style={{ height: `${m.heightPct}%` }}
            aria-hidden
          />
        ))}
      </div>
      {/* Labels i separat grid med samme 5-kolonne struktur så de
          ligger præcis under hver bar uden at påvirke bar-layouten. */}
      <div className="mt-1.5 grid grid-cols-5 gap-2">
        {months.map((m) => (
          <span
            key={m.label}
            className="text-center text-[10px] text-neutral-500"
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// CTA-blok i bunden
// ----------------------------------------------------------------
function CtaBlock() {
  const reducedMotion = useReducedMotion() ?? false;
  // CTA-blok fader ind som én enhed (ingen child-stagger). Egen
  // useInView så den triggeres uafhængigt af steps - hvis brugeren
  // hopper direkte til bunden af sektionen, ser de stadig CTA komme ind.
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, VIEWPORT_OPTIONS);

  return (
    <motion.div
      ref={ref}
      initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      animate={
        isInView || reducedMotion
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: 24 }
      }
      transition={{
        duration: reducedMotion ? 0 : FADE_DURATION,
        ease: EASE,
      }}
      className="mt-16 text-center sm:mt-20"
    >
      <h3
        className="text-2xl tracking-tight text-neutral-900 sm:text-3xl"
        style={{ fontFamily: 'var(--font-zt-nature), system-ui, sans-serif' }}
      >
        Det tager mindre tid end at lave kaffe
      </h3>
      <p className="mx-auto mt-3 max-w-md text-sm text-neutral-600 sm:text-base">
        Du kan starte med din løn alene. Faste udgifter kan du tilføje
        senere når du har en kop i hånden.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Opret konto gratis
        </Link>
        <Link
          href="/login"
          className="text-xs text-neutral-500 transition hover:text-neutral-900 hover:underline"
        >
          Eller log ind hvis du allerede har en konto
        </Link>
      </div>
    </motion.div>
  );
}
