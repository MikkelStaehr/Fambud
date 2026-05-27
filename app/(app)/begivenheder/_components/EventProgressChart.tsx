// Lille fremdriftsgraf til en begivenheds detalje-side.
//
// Appen er flow-orienteret (ingen saldo-data), så grafen er en PROJEKTION
// fremad: en linje der stiger fra nu (0) med den nuværende månedlige
// opsparingsrate, op mod en målstreg (budgettet). Deadline markeres som en
// lodret linje. Visuelt kan man se om opsparings-linjen rammer målstregen
// FØR eller EFTER deadline:
//   • rammer før/på deadline  → grøn (på sporet)
//   • rammer ikke inden       → amber (bagud), linjen ender under målstregen
//
//   kr
//   mål ┤- - - - - - - - - ●          ← målstreg (budget)
//       │              ╱
//       │          ╱
//       │      ╱  ← projektion (nuværende rate)
//     0 └──────────────────┤
//       nu            deadline

import { formatAmount } from '@/lib/format';

type Props = {
  budget: number | null;        // målbeløb (øre)
  monthsRemaining: number | null;
  monthlyRate: number;          // nuværende månedlige opsparing (øre/md)
};

const W = 720;
const H = 220;
const PAD_LEFT = 60;
const PAD_RIGHT = 18;
const PAD_TOP = 22;
const PAD_BOTTOM = 38;
const CHART_W = W - PAD_LEFT - PAD_RIGHT;
const CHART_H = H - PAD_TOP - PAD_BOTTOM;

const LINE_ON_TRACK = '#4B4D39'; // olive
const LINE_BEHIND = '#9A4A3F';   // terracotta
const GOAL_LINE = '#A3A3A3';
const DEADLINE_LINE = '#C5C5A6';
const AXIS_LABEL = '#737373';

function formatMonths(m: number): string {
  const r = Math.round(m);
  if (r < 12) return `${r} mdr.`;
  const years = Math.floor(r / 12);
  const rem = r % 12;
  const y = years === 1 ? '1 år' : `${years} år`;
  return rem === 0 ? y : `${y} ${rem} mdr.`;
}

export function EventProgressChart({
  budget,
  monthsRemaining,
  monthlyRate,
}: Props) {
  // Vi kan kun projicere hvis der er et budget, en deadline i fremtiden, og
  // en aktiv opsparingsrate. Ellers en kort forklaring i stedet.
  if (budget == null || budget <= 0) {
    return (
      <Fallback text="Sæt et budget for begivenheden, så kan jeg vise en fremdriftsgraf." />
    );
  }
  if (monthsRemaining == null || monthsRemaining <= 0) {
    return (
      <Fallback text="Tilføj en deadline i fremtiden, så kan jeg projicere fremdriften mod målet." />
    );
  }
  if (monthlyRate <= 0) {
    return (
      <Fallback text="Opsæt en månedlig overførsel, så tegner jeg en linje der viser hvornår I når målet." />
    );
  }

  const N = monthsRemaining;
  const rate = monthlyRate;
  const monthsToGoal = budget / rate;
  const onTrack = monthsToGoal <= N;

  const xToPx = (month: number) => PAD_LEFT + (month / N) * CHART_W;
  const yToPx = (amount: number) =>
    PAD_TOP + (1 - Math.min(1, amount / budget)) * CHART_H;

  // Projektions-linjens punkter.
  const points: string[] = [`${xToPx(0)},${yToPx(0)}`];
  if (onTrack) {
    // Stiger til målstregen ved monthsToGoal, derefter fladt til deadline.
    points.push(`${xToPx(monthsToGoal)},${yToPx(budget)}`);
    points.push(`${xToPx(N)},${yToPx(budget)}`);
  } else {
    // Når ikke målet inden deadline - ender under målstregen.
    points.push(`${xToPx(N)},${yToPx(rate * N)}`);
  }

  const projectedAtDeadline = Math.min(rate * N, budget);
  const lineColor = onTrack ? LINE_ON_TRACK : LINE_BEHIND;

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Fremdrift mod målet
        </h3>
        <span
          className={`text-xs font-medium ${
            onTrack ? 'text-emerald-800' : 'text-amber-800'
          }`}
        >
          {onTrack
            ? `Når målet om ${formatMonths(monthsToGoal)}`
            : `Bagud - mangler ${formatAmount(budget - projectedAtDeadline)} kr ved deadline`}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
        {/* Målstreg (budget) */}
        <line
          x1={PAD_LEFT}
          y1={yToPx(budget)}
          x2={W - PAD_RIGHT}
          y2={yToPx(budget)}
          stroke={GOAL_LINE}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text x={PAD_LEFT} y={yToPx(budget) - 5} fontSize={9} fill={AXIS_LABEL}>
          Mål: {formatAmount(budget)} kr
        </text>

        {/* Nul-baseline + Y-akse-labels */}
        <line
          x1={PAD_LEFT}
          y1={yToPx(0)}
          x2={W - PAD_RIGHT}
          y2={yToPx(0)}
          stroke="#E5E5E5"
          strokeWidth={1}
        />
        <text x={PAD_LEFT - 6} y={yToPx(0) + 3} fontSize={9} fill={AXIS_LABEL} textAnchor="end">
          0 kr
        </text>

        {/* Deadline (lodret) */}
        <line
          x1={xToPx(N)}
          y1={PAD_TOP}
          x2={xToPx(N)}
          y2={yToPx(0)}
          stroke={DEADLINE_LINE}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />

        {/* Projektions-linje */}
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={lineColor}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Markør hvor linjen rammer målstregen (kun hvis på sporet) */}
        {onTrack && (
          <circle cx={xToPx(monthsToGoal)} cy={yToPx(budget)} r={4} fill={LINE_ON_TRACK} />
        )}
        {/* Slut-markør hvis bagud */}
        {!onTrack && (
          <circle cx={xToPx(N)} cy={yToPx(rate * N)} r={4} fill={LINE_BEHIND} />
        )}

        {/* X-akse-labels */}
        <text x={PAD_LEFT} y={H - PAD_BOTTOM + 18} fontSize={9} fill={AXIS_LABEL}>
          Nu
        </text>
        <text
          x={xToPx(N)}
          y={H - PAD_BOTTOM + 18}
          fontSize={9}
          fill={AXIS_LABEL}
          textAnchor="end"
        >
          Deadline ({formatMonths(N)})
        </text>
      </svg>

      <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
        Projektion fra nu med jeres nuværende opsparing på{' '}
        <span className="tabnum font-mono">{formatAmount(rate)} kr/md</span>.
        Linjen viser hvornår I rammer målet ved den rate.
      </p>
    </div>
  );
}

function Fallback({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
      {text}
    </div>
  );
}
