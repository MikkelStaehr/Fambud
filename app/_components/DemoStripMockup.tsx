'use client';

// Animated demo-strip mockup på landing page. Cykler gennem 3 visninger
// hver 5. sekund:
//   1. Udgifter pr. gruppe, fælles (5 horisontale procentbarer)
//   2. Pengestrømmen, april (forenklet sankey-graf med 2 indtægter
//      forgrenet til 5 udgiftskategorier)
//   3. Bolig & lån, detaljer (drill-down med 6 underposter)
//
// Tilgængelighed:
// - useReducedMotion: viser frame 1 statisk hvis OS-flag er sat
// - IntersectionObserver: pause når ude af viewport
//
// Animation: motion (~6KB) - samme stack som HeroDemoMockup. 5-sek
// interval er længere end hero (4 sek) fordi sankey har mere visuel
// information at fordøje.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';

const FRAME_INTERVAL_MS = 5000;
const FADE_DURATION = 0.36;
const EASE = [0.16, 1, 0.3, 1] as const;

// ----------------------------------------------------------------
// Frame 1: Udgifter pr. gruppe (samme layout som det forrige statiske
// kort, bare med opdaterede tal som spec'et)
// ----------------------------------------------------------------
const GROUPS = [
  { label: 'Bolig & lån', amount: 14250, pct: 41, color: '#7c3aed' },
  { label: 'Forsyning & forsikring', amount: 7890, pct: 23, color: '#0891b2' },
  { label: 'Børn', amount: 5640, pct: 16, color: '#eab308' },
  { label: 'Mad', amount: 4320, pct: 12, color: '#16a34a' },
  { label: 'Underholdning', amount: 2730, pct: 8, color: '#ea580c' },
] as const;

// ----------------------------------------------------------------
// Frame 2: Sankey-data
// ----------------------------------------------------------------
const SANKEY_INCOMES = [
  { id: 'p1', label: 'Løn person 1', amount: 28500, color: '#0e7490' },
  { id: 'p2', label: 'Løn person 2', amount: 22100, color: '#06b6d4' },
] as const;

// Buffer/rest merged ind i Opsparing for at reducere visuel støj.
// 8.500 + 1.580 = 10.080 kr. Total stadig 50.600.
const SANKEY_EXPENSES = [
  { id: 'shared', label: 'Faste udgifter, fælles', amount: 28450, color: '#7c3aed' },
  { id: 'private', label: 'Faste udgifter, private', amount: 6200, color: '#a78bfa' },
  { id: 'savings', label: 'Opsparing & buffer', amount: 10080, color: '#16a34a' },
  { id: 'consumption', label: 'Forbrug', amount: 5870, color: '#eab308' },
] as const;

// ----------------------------------------------------------------
// Frame 3: Drill-down af "Bolig & lån" (14.250 kr total)
// ----------------------------------------------------------------
const BOLIG_DETAILS = [
  { label: 'Realkredit, afdrag', amount: 5420, pct: 38, color: '#7c3aed' },
  { label: 'Realkredit, rente', amount: 3180, pct: 22, color: '#8b5cf6' },
  { label: 'Realkredit, bidragssats', amount: 890, pct: 6, color: '#a78bfa' },
  { label: 'Ejerforening', amount: 2850, pct: 20, color: '#6366f1' },
  { label: 'Ejendomsskat', amount: 1420, pct: 10, color: '#4f46e5' },
  { label: 'Husforsikring', amount: 490, pct: 3, color: '#818cf8' },
] as const;

// ----------------------------------------------------------------
// Hovedkomponent
// ----------------------------------------------------------------
export function DemoStripMockup() {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion() ?? false;

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

  useEffect(() => {
    if (reducedMotion || !isVisible) return;
    const id = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % 3);
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reducedMotion, isVisible]);

  // min-height locked til frame 3's faktiske desktop-højde (~360px) +
  // mobile har ekstra plads til sankey-fallback-list (~400px). Ydre
  // container er derfor mindst lige så høj som det højeste frame, så
  // AnimatePresence-fade ikke kollapser layout under transition og
  // får sektionen til at "hoppe".
  //
  // relative + absolute-positioned children: under fade-out af et
  // frame ligger gammelt og nyt frame oven på hinanden i samme
  // koordinatsystem. Uden absolute ville mode="wait" garantere
  // sekventiel rendering, men børnene ville stadig flyde efter hinanden
  // i normal-flow. relative på containeren + h-fuld via min-h sikrer
  // at uanset hvilket frame der er aktivt, fylder det hele containeren.
  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl shadow-neutral-300/30 min-h-[400px] sm:min-h-[360px]"
    >
      <AnimatePresence mode="wait" initial={false}>
        {frameIndex === 0 && (
          <motion.div
            key="frame-groups"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reducedMotion ? 0 : FADE_DURATION, ease: EASE }}
            className="flex h-full min-h-[400px] flex-col sm:min-h-[360px]"
          >
            <GroupsFrame />
          </motion.div>
        )}
        {frameIndex === 1 && (
          <motion.div
            key="frame-sankey"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reducedMotion ? 0 : FADE_DURATION, ease: EASE }}
            className="flex h-full min-h-[400px] flex-col sm:min-h-[360px]"
          >
            <SankeyFrame />
          </motion.div>
        )}
        {frameIndex === 2 && (
          <motion.div
            key="frame-bolig"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reducedMotion ? 0 : FADE_DURATION, ease: EASE }}
            className="flex h-full min-h-[400px] flex-col sm:min-h-[360px]"
          >
            <BoligDetailsFrame />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------------------
// Frame 1
// ----------------------------------------------------------------
function GroupsFrame() {
  // Body bruger flex-1 + flex-col + justify-evenly så de 5 bars fordeler
  // sig jævnt i den lukket-min-højde. Det giver luftig spacing der match'er
  // frame 3's tighter look (6 bars) uden at vi behøver faste pixel-mål.
  return (
    <>
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Udgifter pr. gruppe, fælles
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-evenly p-4">
        {GROUPS.map((g) => (
          <BudgetBar
            key={g.label}
            label={g.label}
            pct={g.pct}
            amount={`${formatKr(g.amount)} kr`}
            color={g.color}
          />
        ))}
      </div>
    </>
  );
}

// ----------------------------------------------------------------
// Frame 2: Sankey
// ----------------------------------------------------------------
function SankeyFrame() {
  // Layout-konstanter for SVG
  const W = 480;
  const H = 280;
  const PAD_Y = 16;
  const COL_W = 10;
  const LEFT_X = 16;
  const RIGHT_X = W - 16 - COL_W;
  const SEGMENT_GAP = 4;
  const TOTAL = 50600;

  const innerH = H - 2 * PAD_Y;
  const incomeGapTotal = (SANKEY_INCOMES.length - 1) * SEGMENT_GAP;
  const expenseGapTotal = (SANKEY_EXPENSES.length - 1) * SEGMENT_GAP;
  const incomeAvailableH = innerH - incomeGapTotal;
  const expenseAvailableH = innerH - expenseGapTotal;

  // Beregn venstre rektangler
  let leftCursor = PAD_Y;
  const incomeBlocks = SANKEY_INCOMES.map((inc) => {
    const h = (inc.amount / TOTAL) * incomeAvailableH;
    const block = { ...inc, y: leftCursor, h };
    leftCursor += h + SEGMENT_GAP;
    return block;
  });

  // Beregn højre rektangler
  let rightCursor = PAD_Y;
  const expenseBlocks = SANKEY_EXPENSES.map((exp) => {
    const h = (exp.amount / TOTAL) * expenseAvailableH;
    const block = { ...exp, y: rightCursor, h };
    rightCursor += h + SEGMENT_GAP;
    return block;
  });

  // Beregn flows. Hver person bidrager proportionalt til hver kategori:
  //   flow(p, e).amount = p.amount * (e.amount / total)
  // Inden for hver venstre-blok stables flows fra top til bund.
  // Inden for hver højre-blok stables flows fra top til bund.
  type Flow = {
    incomeId: string;
    expenseId: string;
    color: string;
    leftY: number;
    leftH: number;
    rightY: number;
    rightH: number;
  };
  const flows: Flow[] = [];

  // Til at tracke sub-cursor inden for hver venstre-blok
  const leftSubCursor: Record<string, number> = {};
  incomeBlocks.forEach((b) => (leftSubCursor[b.id] = b.y));

  // Til at tracke sub-cursor inden for hver højre-blok
  const rightSubCursor: Record<string, number> = {};
  expenseBlocks.forEach((b) => (rightSubCursor[b.id] = b.y));

  // Iteration: for hver kategori, læg flows fra alle indkomster i højre-
  // bunke. Det sikrer at højre-rækkefølgen matcher kategoriens stables.
  expenseBlocks.forEach((exp) => {
    incomeBlocks.forEach((inc) => {
      const amount = (inc.amount / TOTAL) * exp.amount;
      const leftH = (amount / inc.amount) * inc.h;
      const rightH = (amount / exp.amount) * exp.h;
      flows.push({
        incomeId: inc.id,
        expenseId: exp.id,
        // Brug venstre-blokens farve med transparens så flow ser ud
        // som om det "ejer" indkomsten men flyder ind i kategorien.
        color: inc.color,
        leftY: leftSubCursor[inc.id],
        leftH,
        rightY: rightSubCursor[exp.id],
        rightH,
      });
      leftSubCursor[inc.id] += leftH;
      rightSubCursor[exp.id] += rightH;
    });
  });

  // SVG path mellem to bånd: cubic Bezier med kontrolpunkter på midten
  // af x-akslen, så flows krummer blødt fra venstre til højre.
  const flowPath = (f: Flow) => {
    const x1 = LEFT_X + COL_W;
    const x2 = RIGHT_X;
    const cx1 = x1 + (x2 - x1) * 0.5;
    const cx2 = x1 + (x2 - x1) * 0.5;
    const y1Top = f.leftY;
    const y1Bot = f.leftY + f.leftH;
    const y2Top = f.rightY;
    const y2Bot = f.rightY + f.rightH;
    return [
      `M ${x1} ${y1Top}`,
      `C ${cx1} ${y1Top}, ${cx2} ${y2Top}, ${x2} ${y2Top}`,
      `L ${x2} ${y2Bot}`,
      `C ${cx2} ${y2Bot}, ${cx1} ${y1Bot}, ${x1} ${y1Bot}`,
      'Z',
    ].join(' ');
  };

  return (
    <>
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Pengestrømmen, april
        </span>
      </div>
      <div className="grid flex-1 gap-3 p-4 sm:grid-cols-[100px_1fr_140px] sm:items-stretch">
        {/* Venstre labels */}
        <ul className="hidden flex-col justify-between text-right text-xs sm:flex">
          {incomeBlocks.map((b) => (
            <li key={b.id} className="leading-tight">
              <div className="font-medium text-neutral-700">{b.label}</div>
              <div className="tabnum font-mono text-[11px] text-neutral-500">
                {formatKr(b.amount)} kr
              </div>
            </li>
          ))}
        </ul>

        {/* SVG flow - h-full sikrer at SVG'en strækker sig til grid-rækkens
            højde (som er flex-1 inde i frame-containeren). preserveAspectRatio
            "none" lader båndene strække sig vertikalt med plads, hvilket gør
            dem mere læsbare jo højere containeren er. */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full min-h-[180px] w-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          {/* Flows tegnet før blokkene så blokkene ligger ovenpå */}
          {flows.map((f, i) => (
            <path
              key={i}
              d={flowPath(f)}
              fill={f.color}
              fillOpacity={0.35}
            />
          ))}
          {/* Venstre blokke */}
          {incomeBlocks.map((b) => (
            <rect
              key={b.id}
              x={LEFT_X}
              y={b.y}
              width={COL_W}
              height={b.h}
              fill={b.color}
              rx={2}
            />
          ))}
          {/* Højre blokke */}
          {expenseBlocks.map((b) => (
            <rect
              key={b.id}
              x={RIGHT_X}
              y={b.y}
              width={COL_W}
              height={b.h}
              fill={b.color}
              rx={2}
            />
          ))}
        </svg>

        {/* Højre labels */}
        <ul className="hidden flex-col justify-between text-left text-xs sm:flex">
          {expenseBlocks.map((b) => (
            <li key={b.id} className="leading-tight">
              <div className="font-medium text-neutral-700">{b.label}</div>
              <div className="tabnum font-mono text-[11px] text-neutral-500">
                {formatKr(b.amount)} kr
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile fallback: viser indtægter + udgifter som lister under
          SVG'en, fordi 3-kolonne-grid'et ovenfor klapper sammen. */}
      <div className="grid grid-cols-2 gap-3 border-t border-neutral-100 px-4 py-3 text-[11px] sm:hidden">
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            Ind
          </div>
          <ul className="space-y-1">
            {incomeBlocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2">
                <span className="text-neutral-700">{b.label}</span>
                <span className="tabnum font-mono text-neutral-500">
                  {formatKr(b.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            Ud
          </div>
          <ul className="space-y-1">
            {expenseBlocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2">
                <span className="text-neutral-700">{b.label}</span>
                <span className="tabnum font-mono text-neutral-500">
                  {formatKr(b.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------------------
// Frame 3: Drill-down
// ----------------------------------------------------------------
function BoligDetailsFrame() {
  // Frame 3 er typisk den højeste (6 rows + breadcrumb). Vi bruger
  // justify-evenly her også, så bars strækkes hvis containeren er
  // højere end deres summed natural height. Konsistent layout-pattern
  // med GroupsFrame.
  return (
    <>
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
          <ArrowLeft className="h-3 w-3" />
          Bolig & lån, detaljer
        </span>
        <span className="tabnum font-mono text-xs text-neutral-700">
          14.250 kr
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-evenly p-4">
        {BOLIG_DETAILS.map((b) => (
          <BudgetBar
            key={b.label}
            label={b.label}
            pct={b.pct}
            amount={`${formatKr(b.amount)} kr`}
            color={b.color}
          />
        ))}
      </div>
    </>
  );
}

// ----------------------------------------------------------------
// Hjælpere
// ----------------------------------------------------------------
function BudgetBar({
  label,
  pct,
  amount,
  color,
}: {
  label: string;
  pct: number;
  amount: string;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <span className="text-neutral-900">{label}</span>
          <span className="text-xs text-neutral-400">{pct}%</span>
        </span>
        <span className="tabnum font-mono text-sm text-neutral-700">{amount}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// Format-helper: 14250 -> "14.250" (dansk thousands-separator).
function formatKr(amount: number): string {
  return amount.toLocaleString('da-DK');
}
