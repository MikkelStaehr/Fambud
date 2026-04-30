// Sankey-graf der viser hvordan pengene flyder ud af Lønkontoen. Inspireret
// af Apple's cashflow-statement: én kilde i venstre side (Lønkonto), bånd
// flyder ud til højre med BREDDE proportional med beløbet, og hver
// destination får sin egen rektangel.
//
// Vi viser én Sankey pr. lønkonto. Når Mikkel har sin egen lønkonto og
// Louise har sin, får de hver deres pengestrøms-historie.
//
// Bandene farves efter destination's "type":
//   • Privat (rød)     — udgifter direkte fra lønkontoen + transfers til
//                         egne ikke-fælles konti
//   • Fælles (amber)   — transfers til fælles-konti (budget, husholdning)
//   • Opsparing (grå)  — transfers til savings/investment
//
// I modsætning til en strikt Sankey kan summen af outflows godt være større
// end income (saldoen falder). Vi skalerer alt efter det største af de to
// så banderne tegnes korrekt — og viser net som et lille badge øverst.

import type { Account } from '@/lib/database.types';
import type { CashflowGraphData } from '@/lib/dal';
import { formatAmount, ACCOUNT_KIND_LABEL_DA } from '@/lib/format';

type Props = {
  accounts: Account[];        // allerede filtreret (ikke arkiveret, ikke credit)
  graph: CashflowGraphData;
  deficitAccountIds?: Set<string>;
};

type OutflowType = 'private' | 'shared' | 'savings';

const TYPE_FILL: Record<OutflowType, string> = {
  private: '#fca5a5',     // red-300 — bands
  shared: '#fcd34d',      // amber-300
  savings: '#a3a3a3',     // neutral-400
};

const TYPE_STROKE: Record<OutflowType, string> = {
  private: '#b91c1c',     // red-700 — destination border
  shared: '#b45309',      // amber-700
  savings: '#525252',     // neutral-600
};

const TYPE_LABEL: Record<OutflowType, string> = {
  private: 'privat',
  shared: 'fælles',
  savings: 'opsparing',
};

// Layout-konstanter. To-kolonne layout fortæller historien: Lønkonto til
// venstre, så privat-udgifter tæt på (du betaler dig selv først), så
// overførsler længere til højre (du fordeler resten til fælles/opsparing).
//
//   [Lønkonto] ─→ [Private udgifter]                  (kort distance)
//   [Lønkonto] ─→ ─→ ─→ ─→ [Budgetkonto/Husholdning..] (lang distance)
//
// Bands der går til private destinationer kommer fra TOPPEN af Lønkontoens
// outflow; transfer-bands fra BUNDEN. Da private destinationer er
// vertikalt øverst og transfer-destinationer nederst, krydser bandene
// aldrig hinanden.
const W = 720;
const PADDING_X = 12;
const PADDING_Y = 22;
const SOURCE_W = 70;
const SOURCE_X = PADDING_X;
const DEST_W = 5;            // tynd lodret bar pr. destination

// Tre kolonner fortæller historien:
//   1) Private udgifter — TÆT på Lønkonto: "betalt først"
//   2) Fælles overførsler — i midten: "her sender du til husstandens fælles
//      forpligtelser efter du har dækket dit eget"
//   3) Opsparing — LÆNGST til højre: "det der bliver lagt til side til sidst"
//
// Den vandrette afstand er bevidst ujævn: privat tæt på kilden, fælles i
// midten, opsparing helt yderst. Det giver en intuitiv "tidslinje" hvor
// brugerens øje læser fra "betal dig selv først" → "fælles forpligtelser"
// → "opsparing".
const COL_PRIVATE_X = 195;
const LABEL_PRIVATE_X = COL_PRIVATE_X + DEST_W + 8;

const COL_SHARED_X = 360;
const LABEL_SHARED_X = COL_SHARED_X + DEST_W + 8;

const COL_SAVINGS_X = 540;
const LABEL_SAVINGS_X = COL_SAVINGS_X + DEST_W + 8;

const DEST_GAP = 3;          // luft mellem destinationer
const BAR_BASELINE = 140;    // flow-højde-skala
// Minimumshøjde pr. destinationsbånd. Sættes så hvert bånd har plads til
// sit eget label (label ~22px lodret), og fanges UDELUKKENDE på destination-
// siden — kildebåndene beholder den korrekte proportionalitet (ægte
// flow-størrelser). Det giver den klassiske "fan-out" hvor små destinationer
// ser ud til at vokse fra et tyndt kildebånd til et læsbart destinations-
// rektangel. Tidligere var værdien 4px, hvilket gjorde flere små opsparinger
// stable så tæt at labels overlappede selv med spacing-pass'et.
const MIN_BAND_HEIGHT = 20;

export function CashflowGraph({
  accounts,
  graph,
  deficitAccountIds = new Set(),
}: Props) {
  const lonkontos = accounts.filter((a) => a.kind === 'checking');

  if (lonkontos.length === 0 || graph.edges.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
        Ingen pengestrømme registreret endnu. Tilføj indtægter og overførsler
        for at se hvordan pengene flyder.
      </div>
    );
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Pengestrømme (pr. måned)
        </h3>
        <span className="text-[10px] text-neutral-400 sm:hidden">
          stryg vandret →
        </span>
      </div>

      <div className="space-y-6">
        {lonkontos.map((lonkonto) => (
          <LonkontoSankey
            key={lonkonto.id}
            lonkonto={lonkonto}
            graph={graph}
            accountById={accountById}
            isDeficit={deficitAccountIds.has(lonkonto.id)}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
        <Legend color={TYPE_FILL.private} label="Private udgifter" />
        <Legend color={TYPE_FILL.shared} label="Til fælles" />
        <Legend color={TYPE_FILL.savings} label="Til opsparing" />
      </div>
    </div>
  );
}

function LonkontoSankey({
  lonkonto,
  graph,
  accountById,
  isDeficit,
}: {
  lonkonto: Account;
  graph: CashflowGraphData;
  accountById: Map<string, Account>;
  isDeficit: boolean;
}) {
  const detail =
    graph.perAccount.get(lonkonto.id) ??
    { income: 0, expense: 0, transfersIn: 0, transfersOut: 0 };

  // Saml outflows: private udgifter (sum) + alle transfers ud individuelt.
  type Outflow = { label: string; type: OutflowType; amount: number };
  const outflows: Outflow[] = [];

  if (detail.expense > 0) {
    outflows.push({
      label: 'Private udgifter',
      type: 'private',
      amount: detail.expense,
    });
  }

  for (const edge of graph.edges) {
    if (edge.kind !== 'transfer' || edge.from !== lonkonto.id) continue;
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

  // Sortér outflows: privat først (rød), fælles, opsparing — og inden for
  // hver gruppe efter beløb desc. Det gør visuelt sprog konsistent (rød
  // øverst, opsparing nederst).
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

  if (outflows.length === 0) {
    return (
      <div className="text-xs text-neutral-500">
        Ingen pengestrømme fra {lonkonto.name} endnu.
      </div>
    );
  }

  const totalOut = outflows.reduce((s, o) => s + o.amount, 0);
  const totalIn = detail.income;
  // Skalerer Sankey efter den største af de to (income eller udgifter).
  // Normalt er income lidt større, men hvis du bruger mere end du tjener
  // (deficit), skaleres efter udgifterne så banderne stadig fylder korrekt.
  const scaleTotal = Math.max(totalIn, totalOut, 1);
  const net = totalIn - totalOut;

  // Beregn hver destination-rektangels højde (proportional til beløb).
  // Pad små bånd til MIN_BAND_HEIGHT så de er synlige.
  const heights = outflows.map((o) =>
    Math.max(MIN_BAND_HEIGHT, (o.amount / scaleTotal) * BAR_BASELINE)
  );
  const destTotalHeight =
    heights.reduce((s, h) => s + h, 0) + (outflows.length - 1) * DEST_GAP;

  // Source-blok: højden = totalOut's andel af scaleTotal × baseline.
  // Hvis totalOut < totalIn (overskud), er source-blokken kortere end
  // BAR_BASELINE og vi tegner et lille "overskud"-band ovenfor den.
  const sourceFlowHeight = (totalOut / scaleTotal) * BAR_BASELINE;
  const surplusHeight =
    totalIn > totalOut
      ? ((totalIn - totalOut) / scaleTotal) * BAR_BASELINE
      : 0;

  // Vertikal centrering: vælg det højeste af de to kolonner som canvas-højde.
  const contentHeight = Math.max(
    sourceFlowHeight + surplusHeight,
    destTotalHeight
  );

  const sourceTopY =
    PADDING_Y + (contentHeight - sourceFlowHeight - surplusHeight) / 2;
  const surplusY = sourceTopY;
  const sourceFlowTopY = sourceTopY + surplusHeight;

  const destTopY = PADDING_Y + (contentHeight - destTotalHeight) / 2;

  // Beregn hver båndets top/bottom y-koordinater både på source-siden og
  // destination-siden. Source-siden er flush (ingen gaps); destination-siden
  // har DEST_GAP mellem rektanglerne.
  let cumulativeSource = sourceFlowTopY;
  let cumulativeDest = destTopY;
  const bands = outflows.map((o, i) => {
    const h = heights[i];
    const sourceTop = cumulativeSource;
    const sourceBottom =
      sourceTop + (o.amount / scaleTotal) * BAR_BASELINE;
    const destTop = cumulativeDest;
    const destBottom = destTop + h;
    cumulativeSource = sourceBottom;
    cumulativeDest = destBottom + DEST_GAP;
    return {
      ...o,
      sourceTop,
      sourceBottom,
      destTop,
      destBottom,
      destLabelMid: (destTop + destBottom) / 2,
    };
  });

  // Per-kolonne label-spacing pass: når flere bånd er meget tynde (små
  // beløb), ligger deres midte næsten oven i hinanden og labels overlapper.
  // Vi tvinger min. lodret afstand mellem label-midter pr. kolonne — selve
  // bånd-rektanglerne flyttes ikke, kun teksten. Hvert label optager
  // navn (11px) + undertekst (9px) ≈ 22px lodret plads.
  const MIN_LABEL_SPACING = 22;
  const adjustLabelsForType = (t: OutflowType) => {
    const inCol = bands.filter((b) => b.type === t);
    for (let i = 1; i < inCol.length; i++) {
      const minMid = inCol[i - 1].destLabelMid + MIN_LABEL_SPACING;
      if (inCol[i].destLabelMid < minMid) inCol[i].destLabelMid = minMid;
    }
  };
  adjustLabelsForType('private');
  adjustLabelsForType('shared');
  adjustLabelsForType('savings');

  // Canvas-højde skal rumme det laveste label (undertekst sidder ~12px
  // under midten) — ikke kun selve bånd-geometrien.
  const labelBottomMax = bands.reduce(
    (m, b) => Math.max(m, b.destLabelMid + 12),
    0
  );
  const H = Math.max(
    contentHeight + PADDING_Y * 2,
    labelBottomMax + PADDING_Y / 2
  );

  // Bezier-control-punkter beregnes pr. band fordi destinationerne nu
  // kan være i to forskellige kolonner (private tæt på, overførsler langt
  // væk). Helper der regner X-position + control-punkter for et givet band.
  const SOURCE_RIGHT = SOURCE_X + SOURCE_W;
  const destXFor = (type: OutflowType): number =>
    type === 'private'
      ? COL_PRIVATE_X
      : type === 'shared'
        ? COL_SHARED_X
        : COL_SAVINGS_X;
  const labelXFor = (type: OutflowType): number =>
    type === 'private'
      ? LABEL_PRIVATE_X
      : type === 'shared'
        ? LABEL_SHARED_X
        : LABEL_SAVINGS_X;

  // Tjek om vi har bands i hver af de to kolonner — bruges til at
  // beslutte om kolonne-headerne skal vises.
  const hasPrivateBands = bands.some((b) => b.type === 'private');
  const hasSharedBands = bands.some((b) => b.type === 'shared');
  const hasSavingsBands = bands.some((b) => b.type === 'savings');

  return (
    <div>
      {/* Header med kontonavn + nettobevægelse */}
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-neutral-900">
            {lonkonto.name}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-neutral-400">
            {ACCOUNT_KIND_LABEL_DA[lonkonto.kind] ?? lonkonto.kind}
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
              net < 0 ? 'text-red-900' : 'text-emerald-800'
            }`}
          >
            Net {net >= 0 ? '+' : '−'} {formatAmount(Math.abs(net))}
          </span>
        </div>
      </div>

      <div
        className={`overflow-x-auto rounded-md ${
          isDeficit ? 'border border-red-200 bg-red-50/30' : ''
        }`}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block"
          // Cap render-bredden så grafen ikke vokser ukontrollabelt på
          // brede skærme. På smalle skærme scroller den horisontalt
          // inde i overflow-x-auto-containeren.
          style={{ width: '100%', maxWidth: 680, minWidth: 480, height: 'auto' }}
        >
          {/* Bands (tegnes først så rektangler ligger ovenpå) */}
          {bands.map((b, i) => {
            const destLeft = destXFor(b.type);
            const cpx = SOURCE_RIGHT + (destLeft - SOURCE_RIGHT) * 0.5;
            const path =
              `M ${SOURCE_RIGHT} ${b.sourceTop} ` +
              `C ${cpx} ${b.sourceTop}, ${cpx} ${b.destTop}, ${destLeft} ${b.destTop} ` +
              `L ${destLeft} ${b.destBottom} ` +
              `C ${cpx} ${b.destBottom}, ${cpx} ${b.sourceBottom}, ${SOURCE_RIGHT} ${b.sourceBottom} Z`;
            return (
              <path
                key={i}
                d={path}
                fill={TYPE_FILL[b.type]}
                fillOpacity={0.6}
              />
            );
          })}

          {/* Kolonne-headers — placeret over destinations-bjælkerne. Vi
              viser kun en header hvis dens kolonne har destinationer.
              "PRIVATE / FÆLLES / OPSPARING" fortæller historien: betal dig
              selv først, så fælles forpligtelser, så opsparing. */}
          {hasPrivateBands && (
            <text
              x={COL_PRIVATE_X}
              y={PADDING_Y - 8}
              fontSize={9}
              fontWeight={600}
              fill="#737373"
              letterSpacing={0.6}
            >
              PRIVATE
            </text>
          )}
          {hasSharedBands && (
            <text
              x={COL_SHARED_X}
              y={PADDING_Y - 8}
              fontSize={9}
              fontWeight={600}
              fill="#737373"
              letterSpacing={0.6}
            >
              FÆLLES
            </text>
          )}
          {hasSavingsBands && (
            <text
              x={COL_SAVINGS_X}
              y={PADDING_Y - 8}
              fontSize={9}
              fontWeight={600}
              fill="#737373"
              letterSpacing={0.6}
            >
              OPSPARING
            </text>
          )}

          {/* Source-rectangle (Lønkonto) — overskud (hvis der er) i lys grøn,
              flow-del i mørkere neutral. */}
          {surplusHeight > 0 && (
            <rect
              x={SOURCE_X}
              y={surplusY}
              width={SOURCE_W}
              height={surplusHeight}
              fill="#d1fae5"  /* emerald-100 */
              stroke="#10b981" /* emerald-500 */
              strokeWidth={1.5}
              rx={3}
            />
          )}
          <rect
            x={SOURCE_X}
            y={sourceFlowTopY}
            width={SOURCE_W}
            height={sourceFlowHeight}
            fill="#f5f5f4"  /* stone-100 */
            stroke="#525252"
            strokeWidth={1.5}
            rx={3}
          />

          {/* Source-label */}
          <text
            x={SOURCE_X + SOURCE_W / 2}
            y={sourceTopY + (sourceFlowHeight + surplusHeight) / 2 - 4}
            fontSize={11}
            fontWeight={600}
            fill="#171717"
            textAnchor="middle"
          >
            {lonkonto.name}
          </text>
          <text
            x={SOURCE_X + SOURCE_W / 2}
            y={sourceTopY + (sourceFlowHeight + surplusHeight) / 2 + 9}
            fontSize={9}
            fill="#737373"
            textAnchor="middle"
          >
            {formatAmount(totalIn)} kr/md
          </text>

          {/* Surplus-label INDE i den grønne boks. Vi viser den kun hvis
              boksen er høj nok til at kunne rumme teksten uden at den
              klipper kanten. SOURCE_W=70 er smal, så vi runder til hele
              kroner og kalder det "+saldo" på én linje for at få plads. */}
          {surplusHeight >= 16 && (
            <text
              x={SOURCE_X + SOURCE_W / 2}
              y={surplusY + surplusHeight / 2}
              fontSize={9}
              fontWeight={600}
              fill="#065f46"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              + {Math.round((totalIn - totalOut) / 100).toLocaleString('da-DK')} kr saldo
            </text>
          )}

          {/* Destination rectangles + labels — X afhænger af type så
              private-destinationer sidder i kolonne 1 (tæt på Lønkonto)
              og overførsler i kolonne 2 (længere væk). */}
          {bands.map((b, i) => {
            const destX = destXFor(b.type);
            const labelX = labelXFor(b.type);
            const actualMid = (b.destTop + b.destBottom) / 2;
            const labelOffset = Math.abs(b.destLabelMid - actualMid);
            return (
              <g key={i}>
                <rect
                  x={destX}
                  y={b.destTop}
                  width={DEST_W}
                  height={b.destBottom - b.destTop}
                  fill={TYPE_STROKE[b.type]}
                  rx={1}
                />
                {/* Forbindelseslinje fra rektangel til label når label er
                    skubbet pga. spacing — så det er tydeligt hvilket bånd
                    label tilhører. Skjult når label sidder naturligt. */}
                {labelOffset > 3 && (
                  <line
                    x1={destX + DEST_W}
                    y1={actualMid}
                    x2={labelX - 2}
                    y2={b.destLabelMid}
                    stroke="#d4d4d4"
                    strokeWidth={1}
                  />
                )}
                <text
                  x={labelX}
                  y={b.destLabelMid - 4}
                  fontSize={11}
                  fontWeight={500}
                  fill="#171717"
                  dominantBaseline="middle"
                >
                  {b.label}
                </text>
                <text
                  x={labelX}
                  y={b.destLabelMid + 8}
                  fontSize={9}
                  fill="#737373"
                  dominantBaseline="middle"
                >
                  {formatAmount(b.amount)} kr · {TYPE_LABEL[b.type]}
                </text>
              </g>
            );
          })}
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
        style={{ backgroundColor: color, opacity: 0.6 }}
      />
      {label}
    </span>
  );
}
