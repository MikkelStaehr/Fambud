// Dashboardets finansielle hero - den gennemgående "røde tråd": to klart
// adskilte spor, Privat og Fælles, der ALDRIG blandes i ét tal.
//
//   • PRIVAT  = din egen økonomi: din indtægt, dit private forbrug, hvad du
//               overfører ud, og hvad der er tilbage hver måned.
//   • FÆLLES  = husstandens delte konti: hvad de koster, hvor meget der
//               overføres ind, og om de er dækket.
//
// Tallene kommer pre-beregnet fra computePrivatFaelles() i page.tsx, så
// præcis samme klassificering bruges på alle sider.

import { formatAmount } from '@/lib/format';
import { InfoTooltip } from '@/app/_components/InfoTooltip';
import type { PrivatFaellesSummary } from '@/lib/cashflow-analysis';

type Props = {
  summary: PrivatFaellesSummary;
  monthLabel: string;
};

export function PrivatFaellesOverview({ summary, monthLabel }: Props) {
  return (
    <section data-tour="hero-status" className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Din måned
        </h2>
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {monthLabel}
        </span>
      </div>

      {/* I proxy-mode er der 3 panels (Mine / Partner / Fælles). Vi bruger
          1-2-3 kolonner ved md/lg så de tre kasser kan stå side om side
          på desktop og stable pænt på mobile. */}
      <div
        className={
          summary.partner
            ? 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'
            : 'grid grid-cols-1 gap-4 md:grid-cols-2'
        }
      >
        <PrivatPanel privat={summary.privat} />
        {summary.partner && <PartnerPanel partner={summary.partner} />}
        <FaellesPanel faelles={summary.faelles} />
      </div>
    </section>
  );
}

// ---- Partner (proxy-mode) --------------------------------------------------

function PartnerPanel({ partner }: { partner: NonNullable<PrivatFaellesSummary['partner']> }) {
  const { income, expense, transfersOut, net, name } = partner;
  const netPositive = net >= 0;
  return (
    <div className="rounded-lg border border-orange-200 bg-white">
      <div className="flex items-center justify-between rounded-t-lg border-b border-orange-100 bg-orange-50/60 px-4 py-2.5">
        <span className="inline-flex items-center gap-2">
          <span className="rounded bg-orange-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            {name}
          </span>
          <span className="text-sm font-medium text-neutral-900">{name}s økonomi</span>
        </span>
        <InfoTooltip position="left">
          {name}s indtægt, private forbrug og overførsler. Vises her
          fordi du hjælper {name} med opsætning. Handlinger logges
          som dine.
        </InfoTooltip>
      </div>
      <div className="px-4 py-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Tilbage hver måned
        </div>
        <div
          className={`tabnum mt-1 font-mono text-3xl font-semibold ${
            netPositive ? 'text-emerald-800' : 'text-amber-800'
          }`}
        >
          {netPositive ? '+' : '−'} {formatAmount(Math.abs(net))} kr
        </div>
        <p
          className={`mt-0.5 text-sm font-medium ${
            netPositive ? 'text-emerald-800' : 'text-amber-800'
          }`}
        >
          {netPositive
            ? `Der er luft i ${name}s økonomi`
            : `${name}s private forbrug overstiger indtægten`}
        </p>

        <dl className="mt-4 space-y-1.5 border-t border-neutral-100 pt-3 text-sm">
          <Row label="Indtægt" amount={income} sign="+" tone="positive" />
          <Row label="Privat forbrug" amount={expense} sign="−" tone="negative" />
          <Row
            label="Overført ud"
            sublabel="til fælles, opsparing & begivenheder"
            amount={transfersOut}
            sign="−"
            tone="muted"
          />
        </dl>
      </div>
    </div>
  );
}

// ---- Privat ----------------------------------------------------------------

function PrivatPanel({ privat }: { privat: PrivatFaellesSummary['privat'] }) {
  const { income, expense, transfersOut, net } = privat;
  const netPositive = net >= 0;
  return (
    <div className="rounded-lg border border-emerald-200 bg-white">
      <div className="flex items-center justify-between rounded-t-lg border-b border-emerald-100 bg-emerald-50/60 px-4 py-2.5">
        <span className="inline-flex items-center gap-2">
          <span className="rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Privat
          </span>
          <span className="text-sm font-medium text-neutral-900">Din økonomi</span>
        </span>
        <InfoTooltip>
          Kun din egen økonomi: din indtægt (forecast af dine 3 seneste
          lønudbetalinger), dit private forbrug og dine overførsler. Partnerens
          tal indgår ikke her.
        </InfoTooltip>
      </div>
      <div className="px-4 py-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Tilbage hver måned
        </div>
        <div
          className={`tabnum mt-1 font-mono text-3xl font-semibold ${
            netPositive ? 'text-emerald-800' : 'text-amber-800'
          }`}
        >
          {netPositive ? '+' : '−'} {formatAmount(Math.abs(net))} kr
        </div>
        <p
          className={`mt-0.5 text-sm font-medium ${
            netPositive ? 'text-emerald-800' : 'text-amber-800'
          }`}
        >
          {netPositive
            ? 'Der er luft i din private økonomi'
            : 'Dit private forbrug overstiger din indtægt'}
        </p>

        <dl className="mt-4 space-y-1.5 border-t border-neutral-100 pt-3 text-sm">
          <Row label="Indtægt" amount={income} sign="+" tone="positive" />
          <Row label="Privat forbrug" amount={expense} sign="−" tone="negative" />
          <Row
            label="Overført ud"
            sublabel="til fælles, opsparing & begivenheder"
            amount={transfersOut}
            sign="−"
            tone="muted"
          />
        </dl>
      </div>
    </div>
  );
}

// ---- Fælles ----------------------------------------------------------------

function FaellesPanel({ faelles }: { faelles: PrivatFaellesSummary['faelles'] }) {
  const { expense, transfersIn, net } = faelles;
  const covered = net >= 0;
  return (
    <div className="rounded-lg border border-amber-200 bg-white">
      <div className="flex items-center justify-between rounded-t-lg border-b border-amber-100 bg-amber-50/60 px-4 py-2.5">
        <span className="inline-flex items-center gap-2">
          <span className="rounded bg-amber-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Fælles
          </span>
          <span className="text-sm font-medium text-neutral-900">
            Husstandens delte
          </span>
        </span>
        <InfoTooltip position="left">
          Jeres fælleskonti (Budget, Husholdning, Buffer): hvad de koster om
          måneden, og hvor meget der overføres ind fra husstanden. Et negativt
          tal betyder at de fælles udgifter ikke er fuldt dækket endnu.
        </InfoTooltip>
      </div>
      <div className="px-4 py-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          {covered ? 'Dækning' : 'Manglende dækning'}
        </div>
        <div
          className={`tabnum mt-1 font-mono text-3xl font-semibold ${
            covered ? 'text-emerald-800' : 'text-amber-800'
          }`}
        >
          {covered ? '+' : '−'} {formatAmount(Math.abs(net))} kr
        </div>
        <p
          className={`mt-0.5 text-sm font-medium ${
            covered ? 'text-emerald-800' : 'text-amber-800'
          }`}
        >
          {covered
            ? 'De fælles udgifter er dækket'
            : 'De fælles udgifter er ikke fuldt dækket'}
        </p>

        <dl className="mt-4 space-y-1.5 border-t border-neutral-100 pt-3 text-sm">
          <Row label="Fælles udgifter" amount={expense} sign="−" tone="negative" />
          <Row
            label="Overført ind"
            sublabel="fra husstanden"
            amount={transfersIn}
            sign="+"
            tone="positive"
          />
        </dl>
      </div>
    </div>
  );
}

// ---- Delt række ------------------------------------------------------------

function Row({
  label,
  sublabel,
  amount,
  sign,
  tone,
}: {
  label: string;
  sublabel?: string;
  amount: number;
  sign: '+' | '−';
  tone: 'positive' | 'negative' | 'muted';
}) {
  const toneClass = {
    positive: 'text-emerald-800',
    negative: 'text-red-900',
    muted: 'text-neutral-500',
  }[tone];
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-neutral-600">
        {label}
        {sublabel && (
          <span className="ml-1.5 text-xs text-neutral-400">{sublabel}</span>
        )}
      </dt>
      <dd className={`tabnum shrink-0 font-mono ${toneClass}`}>
        {sign} {formatAmount(amount)} kr
      </dd>
    </div>
  );
}
