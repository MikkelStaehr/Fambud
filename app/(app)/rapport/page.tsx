// /rapport - samlet finansrapport til bankmødet (og som personligt
// statusbillede). Ét overblik over husstandens FÆLLES økonomi: samlet
// indkomst, fælles faste udgifter, gæld og rådighedsbeløb.
//
// Print-optimeret: "Gem som PDF"-knappen åbner browserens print-dialog
// (window.print). App-chrome (sidebar, top-bar, beta-notice) er skjult i
// print via print:hidden i layout'et, så kun selve rapporten kommer med.
//
// To ting der er nemme at få galt i halsen:
//   - Husstandens indkomst = Σ income pr. konto fra cashflow-grafen (det
//     inkluderer løn-forecast, modsat getHouseholdFinancialSummary der kun
//     tæller tilbagevendende income).
//   - Låneydelser er bogført som udgifter (under "Bolig & lån"), så de er
//     ALLEREDE en del af de faste udgifter. Vi trækker dem derfor IKKE fra
//     en ekstra gang - lån vises kun som en gældsoversigt. Det var den fejl
//     der tidligere gjorde rådighedsbeløbet kunstigt negativt.
//   - Private udgifter udelades: en bank vurderer husstandens fælles
//     forpligtelser, ikke den enkeltes private forbrug.

import {
  getEconomyPlanData,
  getCashflowGraph,
  getMonthlyExpensesByGroup,
  getHouseholdName,
} from '@/lib/dal';
import {
  formatAmount,
  formatMonthYearDA,
  formatLongDateDA,
  currentYearMonth,
} from '@/lib/format';
import { PrintButton } from './_components/PrintButton';

export default async function RapportPage() {
  const [plan, graph, expenseGroups, householdName] = await Promise.all([
    getEconomyPlanData(),
    getCashflowGraph(),
    getMonthlyExpensesByGroup(),
    getHouseholdName(),
  ]);

  // Husstandens samlede månedlige indkomst.
  let householdIncome = 0;
  for (const d of graph.perAccount.values()) householdIncome += d.income;

  // Faste udgifter = husstandens FÆLLES faste udgifter. Bolig & lån-gruppen
  // indeholder allerede låneydelserne (bogført som udgifter), så de er med
  // her - og må derfor ikke trækkes fra igen som en separat post.
  const faelles = expenseGroups.shared;
  const fixedExpensesTotal = faelles.reduce((s, g) => s + g.monthly, 0);

  // Samlet låneydelse - kun til gældsoversigten + en note. IKKE et separat
  // fradrag i rådighedsbeløbet (det ville dobbelt-tælle, jf. ovenfor).
  const loanPaymentTotal = plan.loans.reduce((s, l) => s + l.monthlyPayment, 0);

  const raadighed = householdIncome - fixedExpensesTotal;

  const gaeldTotal = plan.loans.reduce((s, l) => s + l.balance, 0);
  const annualIncome = householdIncome * 12;
  const gaeldRatio = annualIncome > 0 ? gaeldTotal / annualIncome : null;
  const friAndelPct =
    householdIncome > 0 ? Math.round((raadighed * 100) / householdIncome) : null;

  const monthLabel = formatMonthYearDA(currentYearMonth());
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const memberIncomeSum = plan.members.reduce((s, m) => s + m.monthlyIncome, 0);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Header med titel + Gem-som-PDF (knappen skjules i selve print'et) */}
        <header className="flex flex-col gap-3 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              Finans Rapport
            </h1>
            <p className="mt-1.5 text-sm text-neutral-500">
              {householdName ? `${householdName} · ` : ''}
              {monthCap}
            </p>
            {plan.members.length > 0 && (
              <p className="mt-0.5 text-xs text-neutral-400">
                {plan.members.map((m) => m.name).join(', ')}
              </p>
            )}
          </div>
          <div className="print:hidden">
            <PrintButton />
          </div>
        </header>

        {/* Nøgletal */}
        <section className="mt-6 break-inside-avoid">
          <SectionTitle>Nøgletal</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatTile label="Månedlig indkomst" value={formatAmount(householdIncome)} unit="kr/md" />
            <StatTile label="Faste udgifter" value={formatAmount(fixedExpensesTotal)} unit="kr/md" />
            <StatTile
              label="Rådighedsbeløb"
              value={formatAmount(raadighed)}
              unit="kr/md"
              tone={raadighed > 0 ? 'positive' : raadighed < 0 ? 'negative' : 'neutral'}
              emphasis
            />
            <StatTile label="Gæld i alt" value={formatAmount(gaeldTotal)} unit="kr" />
            <StatTile
              label="Gæld ift. årsindkomst"
              value={gaeldRatio != null ? `${gaeldRatio.toFixed(1).replace('.', ',')}×` : '–'}
              unit={gaeldRatio != null ? 'årsindkomster' : ''}
            />
          </div>
          {friAndelPct != null && (
            <p className="mt-2 text-xs text-neutral-500">
              Rådighedsbeløbet svarer til {friAndelPct}% af den månedlige
              indkomst - det er hvad der er tilbage til dagligt forbrug og
              opsparing efter de faste udgifter (som inkluderer låneydelserne).
            </p>
          )}
        </section>

        {/* Indkomst */}
        <section className="mt-8 break-inside-avoid">
          <SectionTitle>Indkomst</SectionTitle>
          <ReportTable>
            {plan.members.map((m) => (
              <ReportRow
                key={m.id}
                label={m.name}
                note={m.incomeComplete ? undefined : 'estimat'}
                value={formatAmount(m.monthlyIncome)}
              />
            ))}
            <ReportRow label="Husstandens indkomst i alt" value={formatAmount(householdIncome)} total />
          </ReportTable>
          {householdIncome > memberIncomeSum + 100 && (
            <p className="mt-2 text-xs text-neutral-500">
              Totalen inkluderer understøttelse, biindkomst og øvrige
              tilbagevendende indtægter ud over de viste lønforecast.
            </p>
          )}
        </section>

        {/* Faste udgifter - kun husstandens fælles (private udelades for banken) */}
        <section className="mt-8 break-inside-avoid">
          <SectionTitle>Faste udgifter</SectionTitle>
          <p className="mb-2 text-xs text-neutral-500">
            Husstandens fælles faste udgifter pr. måned. Beløbene inkluderer
            låneydelserne (under Bolig & lån); selve gælden er specificeret nedenfor.
          </p>
          {faelles.length === 0 ? (
            <p className="text-sm text-neutral-400">Ingen faste udgifter registreret.</p>
          ) : (
            <ReportTable>
              {faelles.map((g) => (
                <ReportRow key={g.group} label={g.group} value={formatAmount(g.monthly)} />
              ))}
              <ReportRow
                label="Faste udgifter i alt"
                value={formatAmount(fixedExpensesTotal)}
                total
              />
            </ReportTable>
          )}
        </section>

        {/* Lån */}
        <section className="mt-8 break-inside-avoid">
          <SectionTitle>Lån</SectionTitle>
          {plan.loans.length === 0 ? (
            <p className="text-sm text-neutral-400">Ingen lån registreret.</p>
          ) : (
            <ReportTable>
              <li className="flex items-center gap-3 px-1 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                <span className="flex-1">Lån</span>
                <span className="w-16 text-right">Rente</span>
                <span className="w-24 text-right">Ydelse/md</span>
                <span className="w-28 text-right">Restgæld</span>
              </li>
              {plan.loans.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-3 border-t border-neutral-100 px-1 py-2 text-sm"
                >
                  <span className="flex-1 text-neutral-900">{l.name}</span>
                  <span className="w-16 text-right tabnum font-mono text-neutral-600">
                    {l.rate != null ? `${l.rate.toFixed(2).replace('.', ',')}%` : '–'}
                  </span>
                  <span className="w-24 text-right tabnum font-mono text-neutral-700">
                    {formatAmount(l.monthlyPayment)}
                  </span>
                  <span className="w-28 text-right tabnum font-mono font-medium text-neutral-900">
                    {formatAmount(l.balance)}
                  </span>
                </li>
              ))}
              <li className="flex items-center gap-3 border-t-2 border-neutral-200 px-1 pt-2 text-sm font-semibold">
                <span className="flex-1 text-neutral-900">I alt</span>
                <span className="w-16" />
                <span className="w-24 text-right tabnum font-mono text-neutral-900">
                  {formatAmount(loanPaymentTotal)}
                </span>
                <span className="w-28 text-right tabnum font-mono text-neutral-900">
                  {formatAmount(gaeldTotal)}
                </span>
              </li>
            </ReportTable>
          )}
          {plan.loans.length > 0 && (
            <p className="mt-2 text-xs text-neutral-500">
              Ydelserne ({formatAmount(loanPaymentTotal)} kr/md) er allerede
              indregnet i de faste udgifter ovenfor (Bolig & lån) - de lægges
              ikke oveni rådighedsbeløbet. Tabellen viser gælden, ikke en
              ekstra udgift.
            </p>
          )}
        </section>

        <footer className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-400">
          Genereret {formatLongDateDA(new Date())} via FamBud. Tallene dækker
          husstandens fælles økonomi: samlet indkomst og fælles faste udgifter
          (inkl. låneydelser). Private udgifter er udeladt. Beløb er månedlige
          gennemsnit af tilbagevendende poster.
        </footer>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
      {children}
    </h2>
  );
}

function StatTile({
  label,
  value,
  unit,
  tone = 'neutral',
  emphasis = false,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'neutral' | 'positive' | 'negative';
  emphasis?: boolean;
}) {
  const valueColor =
    tone === 'positive'
      ? 'text-emerald-800'
      : tone === 'negative'
        ? 'text-red-900'
        : 'text-neutral-900';
  return (
    <div
      className={`rounded-md border bg-white px-3 py-2.5 ${
        emphasis ? 'border-neutral-900' : 'border-neutral-200'
      }`}
    >
      <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`mt-1 tabnum font-mono text-lg font-semibold ${valueColor}`}>
        {value}
      </div>
      {unit && <div className="text-[10px] text-neutral-400">{unit}</div>}
    </div>
  );
}

function ReportTable({ children }: { children: React.ReactNode }) {
  return <ul className="text-sm">{children}</ul>;
}

function ReportRow({
  label,
  value,
  note,
  total = false,
}: {
  label: string;
  value: string;
  note?: string;
  total?: boolean;
}) {
  return (
    <li
      className={`flex items-baseline justify-between gap-3 px-1 py-1.5 ${
        total
          ? 'border-t border-neutral-200 font-semibold text-neutral-900'
          : 'text-neutral-700'
      }`}
    >
      <span className="flex items-center gap-2">
        {label}
        {note && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700">
            {note}
          </span>
        )}
      </span>
      <span className="tabnum font-mono">{value} kr</span>
    </li>
  );
}
