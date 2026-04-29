// SVG-graf der viser pengestrømmen mellem konti og to syntetiske noder
// (Indtægter / Udgifter). Kanter er farvet efter type — grøn = løn-input,
// grå = overførsel mellem konti, rød = udgifter ud af systemet. Linjernes
// tykkelse er proportional med beløbet pr. måned.
//
// Vi laver det selv i SVG i stedet for at trække en graph-library ind: dataet
// er småt (10-20 noder), kanterne er forudsigelige (4-kolonne DAG) og vi får
// fuld kontrol over visuelt sprog der matcher resten af appen.

import type { Account } from '@/lib/database.types';
import type { CashflowGraphData } from '@/lib/dal';
import { formatAmount, ACCOUNT_KIND_LABEL_DA } from '@/lib/format';

type Props = {
  accounts: Account[];        // allerede filtreret (ikke arkiveret, ikke credit)
  graph: CashflowGraphData;
  deficitAccountIds?: Set<string>; // konti CashflowAdvisor har flagget som problematiske
};

// Layout-konstanter. Alle kolonner har 60-70px gap så edge-labels (fx
// "162.830 kr") kan stå mellem boxes uden at overlappe. Tidligere udgave
// havde kun 30px gap mellem Indtægter og kolonne 1 — labels var hidden
// halvvejs bag næste box.
const COL_X = [10, 220, 420, 640];
const NODE_W = 140;
const NODE_H = 34;
const ROW_GAP = 8;
const PADDING_Y = 12;

export function CashflowGraph({
  accounts,
  graph,
  deficitAccountIds = new Set(),
}: Props) {
  if (accounts.length === 0 || graph.edges.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
        Ingen pengestrømme registreret endnu. Tilføj indtægter, udgifter og
        overførsler for at se grafen.
      </div>
    );
  }

  // Klassificering: konti der modtager indkomst direkte (kind=income-edges)
  // hører i kolonne 1, øvrige (modtager kun via overførsel) i kolonne 2.
  const incomeReceivers = new Set(
    graph.edges.filter((e) => e.kind === 'income').map((e) => e.to)
  );
  const col1 = accounts.filter((a) => incomeReceivers.has(a.id));
  const col2 = accounts.filter((a) => !incomeReceivers.has(a.id));

  // Sortér hver kolonne efter total flow så de tungeste konti vises øverst.
  const totalFlowFor = (id: string) => {
    const d = graph.perAccount.get(id);
    if (!d) return 0;
    return d.income + d.expense + d.transfersIn + d.transfersOut;
  };
  col1.sort((a, b) => totalFlowFor(b.id) - totalFlowFor(a.id));
  col2.sort((a, b) => totalFlowFor(b.id) - totalFlowFor(a.id));

  const positions = new Map<string, { x: number; y: number; w: number; h: number }>();
  const placeColumn = (items: Account[], colIdx: number) => {
    items.forEach((a, i) => {
      positions.set(a.id, {
        x: COL_X[colIdx],
        y: PADDING_Y + i * (NODE_H + ROW_GAP),
        w: NODE_W,
        h: NODE_H,
      });
    });
  };
  placeColumn(col1, 1);
  placeColumn(col2, 2);

  // Split "Udgifter" i to noder: private (fra konti der IKKE har owner_name='Fælles')
  // og fælles (fra konti med owner_name='Fælles'). Det adskiller den private
  // pengeloop fra fælles-økonomien — to separate "regneark" i samme app.
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const isSharedAccount = (id: string) =>
    accountsById.get(id)?.owner_name === 'Fælles';

  const personalExpenseTotal = graph.edges
    .filter((e) => e.kind === 'expense' && !isSharedAccount(e.from))
    .reduce((s, e) => s + e.monthly, 0);
  const sharedExpenseTotal = graph.edges
    .filter((e) => e.kind === 'expense' && isSharedAccount(e.from))
    .reduce((s, e) => s + e.monthly, 0);
  const hasPersonalExpense = personalExpenseTotal > 0;
  const hasSharedExpense = sharedExpenseTotal > 0;

  // Private udgifter placeres på VENSTRE side (col 0) under Indtægter — så
  // privat-loop'en (Lønkonto → personlige udgifter) holder sig på venstre
  // halvdel og ikke krydser bag fælles-konti i col 2. Den læser baglæns
  // (Lønkonto → Private udgifter går højre-til-venstre) hvilket vi
  // håndterer i path-tegningen længere nede.
  //
  // Vi reserverer en ekstra række i col 0 hvis begge skal være der, så
  // totalH er højt nok.
  const requiredCol0Rows = 1 + (hasPersonalExpense ? 1 : 0);
  const maxRows = Math.max(col1.length, col2.length, requiredCol0Rows, 1);
  const totalH = PADDING_Y * 2 + maxRows * (NODE_H + ROW_GAP) - ROW_GAP;

  if (hasPersonalExpense) {
    positions.set('income', {
      x: COL_X[0],
      y: PADDING_Y,
      w: NODE_W,
      h: NODE_H,
    });
    positions.set('expense-personal', {
      x: COL_X[0],
      y: PADDING_Y + NODE_H + ROW_GAP,
      w: NODE_W,
      h: NODE_H,
    });
  } else {
    positions.set('income', {
      x: COL_X[0],
      y: totalH / 2 - NODE_H / 2,
      w: NODE_W,
      h: NODE_H,
    });
  }
  if (hasSharedExpense) {
    positions.set('expense-shared', {
      x: COL_X[3],
      y: totalH / 2 - NODE_H / 2,
      w: NODE_W,
      h: NODE_H,
    });
  }

  // Hjælper der mapper en expense-edge til den korrekte synthetic destination
  // baseret på source-kontoens ejerskab.
  const expenseTargetFor = (fromId: string): 'expense-personal' | 'expense-shared' =>
    isSharedAccount(fromId) ? 'expense-shared' : 'expense-personal';

  const totalW = COL_X[3] + NODE_W + 20;

  // Linjetykkelse normaliseret til max-edge. Holder tegningen visuelt
  // afbalanceret uanset om beløbene varierer 10x eller 100x.
  const maxFlow = Math.max(...graph.edges.map((e) => e.monthly), 1);
  const flowToWidth = (flow: number) => 1.5 + (flow / maxFlow) * 5;

  // Kompakt label: drop decimaler og vis kr i hele tal. Sparer plads og
  // fjerner det visuelle støj på en graf hvor den eksakte øre ikke betyder
  // noget i overblikket.
  const formatCompactKr = (oere: number) =>
    new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(
      Math.round(oere / 100)
    );

  // Vis edge-labels på alle ikke-trivielle kanter. Threshold på 2% af
  // største flow filtrerer kun mikrotransfers fra (fx en 50kr-overførsel
  // når lønnen er 80k) som ellers ville støje.
  const labelThreshold = maxFlow * 0.02;

  const totalIncome = graph.edges
    .filter((e) => e.kind === 'income')
    .reduce((s, e) => s + e.monthly, 0);

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
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <svg
          viewBox={`0 0 ${totalW} ${totalH}`}
          className="block"
          style={{ minWidth: totalW, width: '100%', height: 'auto' }}
        >
          {/* Kanter tegnes først så de ligger UNDER nodernes rect — en almindelig
              SVG z-order-konvention som er enklere end at flytte alt ind i et
              <g>-lag. */}
          {graph.edges.map((edge, i) => {
            const from = positions.get(edge.from);
            // Expense-kanter peger på den split-specifikke destination:
            // 'expense-personal' eller 'expense-shared'. Income- og transfer-
            // kanter bruger deres oprindelige edge.to.
            const toId =
              edge.kind === 'expense' ? expenseTargetFor(edge.from) : edge.to;
            const to = positions.get(toId);
            if (!from || !to) return null;
            // Detect "backward" flow: target sidder til VENSTRE for source.
            // Det opstår fordi 'expense-personal' nu placeres på venstre
            // side (col 0) for at undgå at krydse fælles-kolonnen. For
            // baglæns-flow forlader linjen source ved venstre kant og
            // ankommer ved target's højre kant — modsat normal forward.
            const isBackward = to.x + to.w <= from.x;
            const x1 = isBackward ? from.x : from.x + from.w;
            const y1 = from.y + from.h / 2;
            const x2 = isBackward ? to.x + to.w : to.x;
            const y2 = to.y + to.h / 2;
            // dx må ALDRIG overstige halvdelen af det vandrette gap, ellers
            // overshooter Bezier-kurven ind i nabo-boxes. For baglæns-flow
            // skifter vi tegnen så kontrolpunkterne stadig pegger UDAD fra
            // begge endepunkter (cp1 venstre, cp2 højre i stedet for omvendt).
            const gap = Math.abs(x2 - x1);
            const dxMag = Math.max(8, gap * 0.45);
            const dx = isBackward ? -dxMag : dxMag;
            const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
            // Klassisk +/- palet: grøn for indkomst, rød for udgifter, slate
            // for overførsler. Vi prøvede neutrale toner men udgifterne
            // forsvandt visuelt — den øjeblikkelige genkendelse af "hvor
            // pengene går ud" er vigtigere end at undgå farveassociationer.
            const stroke =
              edge.kind === 'income'
                ? '#10b981'
                : edge.kind === 'expense'
                  ? '#ef4444'
                  : '#94a3b8';
            // Edge-labels får fortegn baseret på retning: + for indkomst,
            // − for udgifter, intet for overførsler (de er per definition
            // value-neutrale — bare flytning fra konto til konto).
            const sign =
              edge.kind === 'income' ? '+' : edge.kind === 'expense' ? '−' : '';
            return (
              <g key={i}>
                <path
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={flowToWidth(edge.monthly)}
                  strokeOpacity={0.5}
                  strokeLinecap="round"
                />
                {edge.monthly >= labelThreshold && (
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 5}
                    fontSize={9}
                    fill="#475569"
                    textAnchor="middle"
                    style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 3 }}
                  >
                    {sign}
                    {formatCompactKr(edge.monthly)} kr
                  </text>
                )}
              </g>
            );
          })}

          <NodeSVG
            x={positions.get('income')!.x}
            y={positions.get('income')!.y}
            w={NODE_W}
            h={NODE_H}
            title="Indtægter"
            subtitle={`+${formatCompactKr(totalIncome)} kr/md`}
            color="income"
          />
          {hasPersonalExpense && (
            <NodeSVG
              x={positions.get('expense-personal')!.x}
              y={positions.get('expense-personal')!.y}
              w={NODE_W}
              h={NODE_H}
              title="Private udgifter"
              subtitle={`−${formatCompactKr(personalExpenseTotal)} kr/md`}
              color="expense"
            />
          )}
          {hasSharedExpense && (
            <NodeSVG
              x={positions.get('expense-shared')!.x}
              y={positions.get('expense-shared')!.y}
              w={NODE_W}
              h={NODE_H}
              title="Fælles udgifter"
              subtitle={`−${formatCompactKr(sharedExpenseTotal)} kr/md`}
              color="expense"
            />
          )}

          {accounts.map((a) => {
            const pos = positions.get(a.id);
            if (!pos) return null;
            const d = graph.perAccount.get(a.id) ?? {
              income: 0,
              expense: 0,
              transfersIn: 0,
              transfersOut: 0,
            };
            const inflow = d.income + d.transfersIn;
            const outflow = d.expense + d.transfersOut;
            const net = inflow - outflow;
            const isDeficit = deficitAccountIds.has(a.id);
            const hasFlow = inflow > 0 || outflow > 0;
            // Underdækkede konti vises i amber/gul — det er en "kræver
            // opmærksomhed"-signal, ikke et "noget er galt"-signal som rød
            // ville give. Almindelige konti bruger neutral grå.
            const color: NodeColor = isDeficit ? 'warning' : 'neutral';
            // Vis net på ALLE konti med flow så brugeren kan se hvor meget
            // hver konto bidrager. Konti uden flow dæmpes så de ikke
            // forstyrrer det visuelle (de eksisterer, men er ikke en del af
            // pengestrømmen).
            const right = !hasFlow
              ? ''
              : net > 0
                ? `+${formatCompactKr(net)} kr`
                : net < 0
                  ? `−${formatCompactKr(-net)} kr`
                  : '';
            return (
              <NodeSVG
                key={a.id}
                x={pos.x}
                y={pos.y}
                w={pos.w}
                h={pos.h}
                title={a.name}
                subtitle={ACCOUNT_KIND_LABEL_DA[a.kind] ?? a.kind}
                right={right}
                color={color}
                dim={!hasFlow}
              />
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-1 w-6 rounded-full bg-emerald-500/70" />
          Indtægter (+)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-1 w-6 rounded-full bg-slate-400/70" />
          Overførsler
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-1 w-6 rounded-full bg-red-500/70" />
          Udgifter (−)
        </span>
      </div>
    </div>
  );
}

// Værdineutral palet — ingen rød/grøn. Ind = blå (fremadlænende), ud = slate
// (faktuel), warning = amber (kræver opmærksomhed, ikke "fejl"), neutral =
// grå. "right"-tallet på en konto bruger samme tone som node-rammen, men
// holder amber-konti subtilt distinkte fra normale.
type NodeColor = 'income' | 'expense' | 'warning' | 'neutral';

function NodeSVG({
  x,
  y,
  w,
  h,
  title,
  subtitle,
  right,
  color,
  dim = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle: string;
  right?: string;
  color: NodeColor;
  dim?: boolean;
}) {
  // Node-paletten matcher edge-paletten ovenfor: grøn for indkomst, rød
  // for udgifter, amber for advarsel (separat fra rød så underdækkede
  // konti ikke smelter sammen med udgifts-noderne), neutral grå for resten.
  const palette: Record<NodeColor, { fill: string; stroke: string; title: string; right: string }> = {
    income:  { fill: '#ecfdf5', stroke: '#10b981', title: '#065f46', right: '#059669' },
    expense: { fill: '#fef2f2', stroke: '#ef4444', title: '#991b1b', right: '#dc2626' },
    warning: { fill: '#fef3c7', stroke: '#d97706', title: '#92400e', right: '#b45309' },
    neutral: { fill: '#f9fafb', stroke: '#d1d5db', title: '#0f172a', right: '#475569' },
  };
  const { fill, stroke, title: titleColor, right: rightColor } = palette[color];

  // 140px brede bokses giver plads til ca. 14 tegn i title, eller ~10 hvis
  // vi også viser right-label.
  const maxTitleLen = right ? 11 : 16;
  const titleTrunc = title.length > maxTitleLen ? title.slice(0, maxTitleLen - 1) + '…' : title;

  return (
    <g opacity={dim ? 0.4 : 1}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={4}
        ry={4}
        fill={fill}
        stroke={stroke}
        strokeWidth={1}
      />
      <text x={x + 8} y={y + 14} fontSize={11} fontWeight={600} fill={titleColor}>
        {titleTrunc}
      </text>
      <text x={x + 8} y={y + 26} fontSize={9} fill="#64748b">
        {subtitle}
      </text>
      {right && (
        <text
          x={x + w - 8}
          y={y + 14}
          fontSize={9}
          fontWeight={600}
          fill={rightColor}
          textAnchor="end"
        >
          {right}
        </text>
      )}
    </g>
  );
}
