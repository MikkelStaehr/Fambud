// Waterfall-graf der viser hvordan månedens indtægt bliver "spist" af
// udgifterne. Inspireret af bridge-/waterfall-charts:
//
//   ┌──┐                                              kr
//   │  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━┓                Indtægts-linjen (Y) starter
//   │  │  ┌──┐                       ┃                højt og falder hver gang
//   │  │  │  │ ━━━━━━━━━━━━━━━━━━━━━━┛━━━━━┓          den krydser en udgift.
//   │  │  │  │ ┌──┐                         ┃         Til slut peger den på
//   │  │  │  │ │  │ ━━━━━━━━━━━━━━━━━━━━━━━━┛━━━━━┓   det resterende beløb
//   │  │  │  │ │  │ ┌──┐                           ┃  (overskud eller underskud).
//   │  │  │  │ │  │ │  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━┛━━┐
//   └──┘  └──┘ └──┘ └──┘                              │ Net
//   Ind   Hus  Mad  Spar                              └─┘
//
// Hver søjle har bredde proportional med plads, men HØJDE proportional med
// beløb. Indtægts-søjlen er fuld (0 til totalIn), udgifts-søjler er
// "før→efter"-skiver (de skærer running-balance ned), og net-søjlen til højre
// viser hvor pengene ender. Underskud rendres under nul-linjen.
//
// Vi viser én graf pr. konto der HAR både inflow og outflow:
//   - Lønkonto: paychecks (filtreret til brugerens egne, så delte lønkonti
//     ikke lægger partnerens løn på som "min indtægt") → private udgifter
//     + transfers til Fælles + opsparing
//   - Budget/Husholdning (Fælles): transfers ind fra husstanden → faste
//     udgifter på kontoen
//   - Personlige opsparinger, depoter osv. (kun hvis de OGSÅ har outflow)

import type { Account } from '@/lib/database.types';
import type { CashflowGraphData } from '@/lib/dal';
import { formatAmount, ACCOUNT_KIND_LABEL_DA } from '@/lib/format';

type Props = {
  accounts: Account[];        // allerede filtreret (ikke arkiveret, ikke credit)
  graph: CashflowGraphData;
  deficitAccountIds?: Set<string>;
};

type OutflowType = 'private' | 'shared' | 'savings';

// Farver justeret til olive-brand-paletten. Distinkte hues per type
// (terracotta/amber/olive) så søjlerne stadig kan læses kategori-wise.
const TYPE_FILL: Record<OutflowType, string> = {
  private: '#E8A89C',     // dusty terracotta - "udgifter du selv står for"
  shared: '#E8C97A',      // sandy amber - "fælles forpligtelser"
  savings: '#A8A988',     // olive-light - "til opsparing"
};

const TYPE_STROKE: Record<OutflowType, string> = {
  private: '#9A4A3F',
  shared: '#8B6320',
  savings: '#5F6244',
};

const TYPE_LABEL: Record<OutflowType, string> = {
  private: 'privat',
  shared: 'fælles',
  savings: 'opsparing',
};

// Brand-farver til indtægts- og net-søjler.
const INCOME_FILL = '#4B4D39';        // olive
const INCOME_STROKE = '#3B3D2B';      // olive-dark
const SURPLUS_FILL = '#A8A988';       // olive-light
const SURPLUS_STROKE = '#6B6D55';
const DEFICIT_FILL = '#E8A89C';       // dusty terracotta - matcher private
const DEFICIT_STROKE = '#9A4A3F';
const RUNNING_LINE = '#404040';       // mørk neutral for stepped linje
const GRID_LINE = '#E5E5E5';
const AXIS_LABEL = '#737373';
const ZERO_LINE = '#A3A3A3';          // bissel kraftigere end gridlines

// Layout: bred SVG der scaleres responsivt. Padding til venstre rummer
// Y-akse-labels, padding nederst rummer roterede søjle-labels.
const W = 720;
const H = 340;
const PAD_LEFT = 56;
const PAD_RIGHT = 16;
const PAD_TOP = 24;
const PAD_BOTTOM = 90;
const CHART_W = W - PAD_LEFT - PAD_RIGHT;
const CHART_H = H - PAD_TOP - PAD_BOTTOM;

export function CashflowGraph({
  accounts,
  graph,
  deficitAccountIds = new Set(),
}: Props) {
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // Find alle konti der HAR både ind- og udflow. Kriterier:
  //   - inflow > 0: enten brugerens egne paychecks ELLER transfers ind
  //     (fælleskonti har ingen paychecks, men finansieres via transfers).
  //   - outflow > 0: enten direkte udgifter PÅ kontoen ELLER transfers ud.
  //
  // Vi filtrerer arkiverede og credit-konti ud allerede i page.tsx, så vi
  // kan stole på `accounts`-listen her. Opsparingskonti der kun MODTAGER
  // (ingen udflow) skippes automatisk - de har ikke en cashflow-historie
  // værd at rendre.
  const renderable = accounts.filter((a) => {
    const d = graph.perAccount.get(a.id);
    if (!d) return false;
    const inflow = d.myIncome + d.transfersIn;
    const outflow = d.expense + d.transfersOut;
    return inflow > 0 && outflow > 0;
  });

  // Sortér: lønkonti først (de er typisk "primær"-historien), så fælleskonti,
  // så resten. Inden for hver gruppe efter inflow desc.
  const KIND_ORDER: Record<string, number> = {
    checking: 0,
    budget: 1,
    household: 2,
  };
  renderable.sort((a, b) => {
    const ka = KIND_ORDER[a.kind] ?? 9;
    const kb = KIND_ORDER[b.kind] ?? 9;
    if (ka !== kb) return ka - kb;
    const da = graph.perAccount.get(a.id)!;
    const db = graph.perAccount.get(b.id)!;
    return (db.myIncome + db.transfersIn) - (da.myIncome + da.transfersIn);
  });

  if (renderable.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
        Ingen pengestrømme registreret endnu. Tilføj indtægter og overførsler
        for at se hvordan pengene flyder.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Pengestrømme (pr. måned)
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {renderable.map((a) => (
          <AccountWaterfall
            key={a.id}
            account={a}
            graph={graph}
            accountById={accountById}
            isDeficit={deficitAccountIds.has(a.id)}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
        <Legend color={INCOME_FILL} label="Indtægt / overført ind" />
        <Legend color={TYPE_FILL.private} label="Private udgifter" />
        <Legend color={TYPE_FILL.shared} label="Til fælles" />
        <Legend color={TYPE_FILL.savings} label="Til opsparing" />
      </div>
    </div>
  );
}

function AccountWaterfall({
  account,
  graph,
  accountById,
  isDeficit,
}: {
  account: Account;
  graph: CashflowGraphData;
  accountById: Map<string, Account>;
  isDeficit: boolean;
}) {
  const detail =
    graph.perAccount.get(account.id) ??
    { income: 0, myIncome: 0, expense: 0, transfersIn: 0, transfersOut: 0 };

  // Indtægt = mine egne paychecks (på delte lønkonti tæller partnerens IKKE
  // med - dashboardet er min personlige historie) + transfers ind. På
  // Fælles Budget er myIncome=0 men transfersIn er hele inflow'et.
  const isShared = account.owner_name === 'Fælles';
  const expenseLabel = isShared ? 'Faste udgifter' : 'Private udgifter';

  type Outflow = { label: string; type: OutflowType; amount: number };
  const outflows: Outflow[] = [];

  if (detail.expense > 0) {
    outflows.push({
      label: expenseLabel,
      type: 'private',
      amount: detail.expense,
    });
  }

  for (const edge of graph.edges) {
    if (edge.kind !== 'transfer' || edge.from !== account.id) continue;
    const dest = accountById.get(edge.to);
    if (!dest) continue;
    const type: OutflowType =
      dest.kind === 'savings' || dest.kind === 'investment'
        ? 'savings'
        : dest.owner_name === 'Fælles'
          ? 'shared'
          : 'private';
    outflows.push({ label: dest.name, type, amount: edge.monthly });
  }

  // Sortér: privat først, fælles, opsparing - inden for hver gruppe efter
  // beløb desc. Det giver en konsistent "først betaler du dig selv, så
  // husstanden, så opsparing"-narrativ.
  const TYPE_ORDER: Record<OutflowType, number> = {
    private: 0,
    shared: 1,
    savings: 2,
  };
  outflows.sort((a, b) => {
    const t = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
    if (t !== 0) return t;
    return b.amount - a.amount;
  });

  const totalIn = detail.myIncome + detail.transfersIn;
  const totalOut = outflows.reduce((s, o) => s + o.amount, 0);
  const net = totalIn - totalOut;

  if (totalIn === 0 && totalOut === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-200 bg-white px-4 py-6 text-center text-xs text-neutral-500">
        Ingen pengestrømme fra {account.name} endnu.
      </div>
    );
  }

  // Y-akse-range: top = max(totalIn, 0), bottom = min(net, 0). Hvis du
  // bruger mere end du tjener, skal Y-aksen kunne gå under nul.
  const yMax = Math.max(totalIn, 0);
  const yMin = Math.min(net, 0);
  const yRange = yMax - yMin || 1;
  const yToPx = (y: number) =>
    PAD_TOP + ((yMax - y) / yRange) * CHART_H;

  // X-akse: kolonner = [indtægt, ...udgifter, net]. Hvis udgifterne er
  // tomme, skipper vi midten - så graphen alligevel viser indtægt + net.
  const numCols = 1 + outflows.length + 1;
  const colSpacing = CHART_W / numCols;
  const barWidth = Math.min(colSpacing * 0.7, 44);
  const colCenter = (i: number) =>
    PAD_LEFT + colSpacing * (i + 0.5);
  const barLeft = (i: number) => colCenter(i) - barWidth / 2;
  const barRight = (i: number) => colCenter(i) + barWidth / 2;

  // Trin: hver udgift skærer running-balance ned.
  type Step = Outflow & {
    before: number;
    after: number;
    colIdx: number;
  };
  const steps: Step[] = [];
  let running = totalIn;
  for (let i = 0; i < outflows.length; i++) {
    const o = outflows[i];
    const before = running;
    const after = running - o.amount;
    steps.push({ ...o, before, after, colIdx: i + 1 });
    running = after;
  }

  // Y-akse ticks. Vi vil have 4-5 jævnt fordelte tick-værdier på "nice"
  // tal (afrundet til nærmeste 1.000, 5.000 eller 10.000 afhængigt af
  // range). Heuristik: del totalIn op i 4-5 stykker, find passende step.
  const ticks = computeNiceTicks(yMin, yMax, 4);

  // Stepped running-line: starter på toppen af indtægts-søjlen, falder ved
  // hver udgifts-søjle, ender ved net. Bygges som polyline-points.
  const linePoints: string[] = [];
  // Start: top af indtægts-søjle
  linePoints.push(`${barRight(0)},${yToPx(totalIn)}`);
  let lineRunning = totalIn;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    // Horisontal til toppen af denne udgifts-søjle
    linePoints.push(`${barLeft(s.colIdx)},${yToPx(lineRunning)}`);
    // Diagonal/vertikal ned langs venstre kant af søjlen til "efter"-niveau
    linePoints.push(`${barLeft(s.colIdx)},${yToPx(s.after)}`);
    lineRunning = s.after;
  }
  // Efter sidste udgift: horisontal til venstre kant af net-søjlen
  linePoints.push(`${barLeft(numCols - 1)},${yToPx(lineRunning)}`);

  // Net-søjlens layout: fylder mellem 0 og net (positivt over, negativt
  // under). Bar y/height beregnes ud fra fortegn.
  const netTop = yToPx(Math.max(net, 0));
  const netBottom = yToPx(Math.min(net, 0));
  const netHeight = Math.max(2, netBottom - netTop);

  // Indtægts-søjlens layout: fra 0 til totalIn (altid positiv).
  const incomeTop = yToPx(totalIn);
  const incomeBottom = yToPx(0);

  return (
    <div>
      {/* Header med kontonavn + opsummering */}
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-neutral-900">
            {account.name}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-neutral-400">
            {ACCOUNT_KIND_LABEL_DA[account.kind] ?? account.kind}
            {isShared && ' · Fælles'}
          </span>
        </div>
        <div className="flex items-baseline gap-3 text-xs">
          <span className="tabnum font-mono text-emerald-800">
            + {formatAmount(totalIn)} ind
          </span>
          <span className="tabnum font-mono text-neutral-700">
            − {formatAmount(totalOut)} ud
          </span>
          <span
            className={`tabnum font-mono font-semibold ${
              net < 0 ? 'text-amber-800' : 'text-emerald-800'
            }`}
          >
            Net {net >= 0 ? '+' : '−'} {formatAmount(Math.abs(net))}
          </span>
        </div>
      </div>

      {/* Mobile fallback: simpel liste */}
      <ul
        className={`flex flex-col gap-1.5 rounded-md md:hidden ${
          isDeficit ? 'border border-amber-200 bg-amber-50/40 p-3' : ''
        }`}
      >
        <li className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: INCOME_FILL }}
              aria-hidden="true"
            />
            <span className="truncate text-sm text-neutral-900">Indtægt</span>
          </div>
          <span className="tabnum shrink-0 font-mono text-sm text-emerald-800">
            + {formatAmount(totalIn)} kr
          </span>
        </li>
        {outflows.map((o, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-1.5 last:border-0 last:pb-0"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{
                  backgroundColor: TYPE_FILL[o.type],
                  border: `1px solid ${TYPE_STROKE[o.type]}`,
                }}
                aria-hidden="true"
              />
              <span className="truncate text-sm text-neutral-900">
                {o.label}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-neutral-400">
                {TYPE_LABEL[o.type]}
              </span>
            </div>
            <span className="tabnum shrink-0 font-mono text-sm text-neutral-700">
              − {formatAmount(o.amount)} kr
            </span>
          </li>
        ))}
        <li className="mt-1 flex items-center justify-between gap-3 border-t border-neutral-200 pt-2 font-semibold">
          <span className="text-sm text-neutral-900">
            {net >= 0 ? 'Overskud' : 'Underskud'}
          </span>
          <span
            className={`tabnum font-mono text-sm ${
              net < 0 ? 'text-amber-800' : 'text-emerald-800'
            }`}
          >
            {net >= 0 ? '+' : '−'} {formatAmount(Math.abs(net))} kr
          </span>
        </li>
      </ul>

      {/* Desktop: SVG-waterfall */}
      <div
        className={`hidden overflow-x-auto rounded-md md:block ${
          isDeficit ? 'border border-amber-200 bg-amber-50/40' : ''
        }`}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block"
          style={{ width: '100%', maxWidth: 720, minWidth: 320, height: 'auto' }}
        >
          {/* Y-akse-label */}
          <text
            x={PAD_LEFT - 8}
            y={PAD_TOP - 8}
            fontSize={9}
            fill={AXIS_LABEL}
            textAnchor="end"
          >
            kr/md
          </text>

          {/* Gridlines + Y-tick-labels */}
          {ticks.map((t) => {
            const y = yToPx(t);
            const isZero = t === 0;
            return (
              <g key={t}>
                <line
                  x1={PAD_LEFT}
                  y1={y}
                  x2={W - PAD_RIGHT}
                  y2={y}
                  stroke={isZero ? ZERO_LINE : GRID_LINE}
                  strokeWidth={isZero ? 1 : 0.5}
                  strokeDasharray={isZero ? undefined : '2 3'}
                />
                <text
                  x={PAD_LEFT - 6}
                  y={y + 3}
                  fontSize={9}
                  fill={AXIS_LABEL}
                  textAnchor="end"
                >
                  {formatTick(t)}
                </text>
              </g>
            );
          })}

          {/* Indtægts-søjle */}
          <rect
            x={barLeft(0)}
            y={incomeTop}
            width={barWidth}
            height={incomeBottom - incomeTop}
            fill={INCOME_FILL}
            stroke={INCOME_STROKE}
            strokeWidth={1.5}
            rx={2}
          />
          <text
            x={colCenter(0)}
            y={incomeTop - 6}
            fontSize={10}
            fontWeight={600}
            fill={INCOME_STROKE}
            textAnchor="middle"
          >
            + {formatAmount(totalIn)}
          </text>

          {/* Stepped running-line (oven på søjlerne) */}
          <polyline
            points={linePoints.join(' ')}
            fill="none"
            stroke={RUNNING_LINE}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="4 3"
          />

          {/* Udgifts-søjler */}
          {steps.map((s, i) => {
            const top = yToPx(s.before);
            const bottom = yToPx(s.after);
            const h = Math.max(2, bottom - top);
            const zeroY = yToPx(0);
            // Søjler der KRYDSER nullinjen (positivt → negativt) er
            // problematiske: et center-placeret label lander oven på den
            // bolde nul-gridline og bliver ulæseligt. Vi flytter labelen
            // op i søjlens positive halvdel.
            const crossesZero = top < zeroY && bottom > zeroY;
            const labelY = crossesZero
              ? top + (zeroY - top) / 2 + 3
              : h >= 14
                ? top + h / 2 + 3
                : top - 4;
            return (
              <g key={i}>
                <rect
                  x={barLeft(s.colIdx)}
                  y={top}
                  width={barWidth}
                  height={h}
                  fill={TYPE_FILL[s.type]}
                  fillOpacity={0.85}
                  stroke={TYPE_STROKE[s.type]}
                  strokeWidth={1.25}
                  rx={2}
                />
                <text
                  x={colCenter(s.colIdx)}
                  y={labelY}
                  fontSize={9}
                  fontWeight={600}
                  fill={TYPE_STROKE[s.type]}
                  textAnchor="middle"
                >
                  − {formatAmount(s.amount)}
                </text>
                {/* Roteret label under X-aksen */}
                <text
                  x={colCenter(s.colIdx)}
                  y={H - PAD_BOTTOM + 14}
                  fontSize={10}
                  fill="#404040"
                  textAnchor="end"
                  transform={`rotate(-35, ${colCenter(s.colIdx)}, ${H - PAD_BOTTOM + 14})`}
                >
                  {truncate(s.label, 18)}
                </text>
              </g>
            );
          })}

          {/* Net-søjle (overskud eller underskud).
              - Overskud: amount-label sidder OVENPÅ søjlen
              - Underskud: amount-label sidder INDENI søjlen (centreret),
                så det ikke overlapper med "Underskud"-x-akse-labelen der
                naturligt sidder lige under chart-området. */}
          <rect
            x={barLeft(numCols - 1)}
            y={netTop}
            width={barWidth}
            height={netHeight}
            fill={net >= 0 ? SURPLUS_FILL : DEFICIT_FILL}
            stroke={net >= 0 ? SURPLUS_STROKE : DEFICIT_STROKE}
            strokeWidth={1.5}
            rx={2}
          />
          <text
            x={colCenter(numCols - 1)}
            y={net >= 0 ? netTop - 6 : netTop + netHeight / 2 + 4}
            fontSize={10}
            fontWeight={700}
            fill={net >= 0 ? SURPLUS_STROKE : DEFICIT_STROKE}
            textAnchor="middle"
          >
            {net >= 0 ? '+' : '−'} {formatAmount(Math.abs(net))}
          </text>

          {/* X-akse-labels: Indtægt og Net */}
          <text
            x={colCenter(0)}
            y={H - PAD_BOTTOM + 14}
            fontSize={10}
            fontWeight={600}
            fill="#404040"
            textAnchor="middle"
          >
            Indtægt
          </text>
          <text
            x={colCenter(numCols - 1)}
            y={H - PAD_BOTTOM + 14}
            fontSize={10}
            fontWeight={600}
            fill={net >= 0 ? SURPLUS_STROKE : DEFICIT_STROKE}
            textAnchor="middle"
          >
            {net >= 0 ? 'Overskud' : 'Underskud'}
          </text>
        </svg>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-4 rounded-sm"
        style={{ backgroundColor: color, opacity: 0.85 }}
      />
      {label}
    </span>
  );
}

// "Nice" tick-værdier: vælg en step-størrelse der giver ~target ticks
// inden for [min, max], og afrundet til 1/2/2.5/5 × 10^n. Returnerer
// ticks i øre (samme enhed som beløb).
function computeNiceTicks(
  minOre: number,
  maxOre: number,
  target: number
): number[] {
  if (maxOre === minOre) return [minOre];
  const range = maxOre - minOre;
  const rawStep = range / target;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.abs(rawStep))));
  const norm = rawStep / pow;
  let niceStep: number;
  if (norm < 1.5) niceStep = 1 * pow;
  else if (norm < 3) niceStep = 2 * pow;
  else if (norm < 7) niceStep = 5 * pow;
  else niceStep = 10 * pow;
  const start = Math.ceil(minOre / niceStep) * niceStep;
  const end = Math.floor(maxOre / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = start; v <= end + 0.5; v += niceStep) ticks.push(v);
  // Sørg for at 0 altid er med hvis range krydser nul
  if (minOre < 0 && maxOre > 0 && !ticks.includes(0)) {
    ticks.push(0);
    ticks.sort((a, b) => a - b);
  }
  return ticks;
}

// Kort-form af tick-værdi (øre): "12.000" / "1.500" osv. Uden "kr"-suffix
// fordi Y-akse-headeren allerede siger "kr/md".
function formatTick(ore: number): string {
  const kr = Math.round(ore / 100);
  return kr.toLocaleString('da-DK');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
