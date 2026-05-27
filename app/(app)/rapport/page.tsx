// /rapport - samlet finansrapport. Ét overblik over husstandens økonomi
// (indkomst, faste udgifter, lån, rådighedsbeløb, 50/30/20) som både duer
// som personligt statusbillede og som dokument til bankmødet.
//
// Print-optimeret: "Gem som PDF"-knappen åbner browserens print-dialog
// (window.print). App-chrome (sidebar, top-bar, beta-notice) er skjult i
// print via print:hidden i layout'et, så kun selve rapporten kommer med.
//
// Tallene er bevidst de SAMME som dashboardet og Rådgiveren viser:
//   - Husstandens indkomst = Σ income pr. konto fra cashflow-grafen (det
//     inkluderer løn-forecast, modsat getHouseholdFinancialSummary der kun
//     tæller tilbagevendende income).
//   - Faste udgifter = summen af kategori-grupperne (Privat + Fælles), så
//     opdelingen længere nede stemmer med totalen.
//   - Låneydelser holdes adskilt fra faste udgifter (de er konto-metadata,
//     ikke expense-transaktioner), så rådighedsbeløbet ikke dobbelt-tæller.

import {
  getEconomyPlanData,
  getCashflowGraph,
  getMonthlyExpensesByGroup,
  getHouseholdName,
} from '@/lib/dal';
import { computeFiftyThirtyTwenty } from '@/lib/economy-plan';
import {
  formatAmount,
  formatMonthYearDA,
  formatLongDateDA,
  currentYearMonth,
} from '@/lib/format';
import type { CategoryGroup } from '@/lib/categories';
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

  const faelles = expenseGroups.shared;
  const privat = expenseGroups.private;
  const faellesTotal = faelles.reduce((s, g) => s + g.monthly, 0);
  const privatTotal = privat.reduce((s, g) => s + g.monthly, 0);
  const fixedExpensesTotal = faellesTotal + privatTotal;

  const loanPayments = plan.monthlyLoanPayments;
  const raadighed = householdIncome - fixedExpensesTotal - loanPayments;

  const gaeldTotal = plan.loans.reduce((s, l) => s + l.balance, 0);
  const annualIncome = householdIncome * 12;
  const gaeldRatio = annualIncome > 0 ? gaeldTotal / annualIncome : null;
  const friAndelPct =
    householdIncome > 0 ? Math.round((raadighed * 100) / householdIncome) : null;

  // 50/30/20 på husstands-niveau: kombinér private + fælles udgiftsgrupper
  // og lad computeFiftyThirtyTwenty bucket'e dem til behov/forbrug/opsparing.
  const combinedMap = new Map<CategoryGroup, number>();
  for (const g of [...privat, ...faelles]) {
    combinedMap.set(g.group, (combinedMap.get(g.group) ?? 0) + g.monthly);
  }
  const combinedGroups = Array.from(combinedMap, ([group, monthly]) => ({
    group,
    monthly,
  }));
  const fiftyThirtyTwenty =
    householdIncome > 0
      ? computeFiftyThirtyTwenty({
          income: householdIncome,
          faellesContribution: 0,
          privateGroups: combinedGroups,
        })
      : null;

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
            <StatTile label="Låneydelser" value={formatAmount(loanPayments)} unit="kr/md" />
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
              opsparing efter faste udgifter og låneydelser.
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

        {/* Faste udgifter - Privat/Fælles */}
        <section className="mt-8 break-inside-avoid">
          <SectionTitle>Faste udgifter</SectionTitle>

          <h3 className="mb-1.5 mt-2 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            Fælles
          </h3>
          {faelles.length === 0 ? (
            <p className="text-sm text-neutral-400">Ingen fælles faste udgifter.</p>
          ) : (
            <ReportTable>
              {faelles.map((g) => (
                <ReportRow key={g.group} label={g.group} value={formatAmount(g.monthly)} />
              ))}
              <ReportRow label="Fælles i alt" value={formatAmount(faellesTotal)} total />
            </ReportTable>
          )}

          <h3 className="mb-1.5 mt-4 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            Privat
          </h3>
          {privat.length === 0 ? (
            <p className="text-sm text-neutral-400">Ingen private faste udgifter.</p>
          ) : (
            <ReportTable>
              {privat.map((g) => (
                <ReportRow key={g.group} label={g.group} value={formatAmount(g.monthly)} />
              ))}
              <ReportRow label="Privat i alt" value={formatAmount(privatTotal)} total />
            </ReportTable>
          )}

          <div className="mt-3 border-t border-neutral-200 pt-2">
            <ReportRow label="Faste udgifter i alt" value={formatAmount(fixedExpensesTotal)} total />
          </div>
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
                  {formatAmount(plan.loans.reduce((s, l) => s + l.monthlyPayment, 0))}
                </span>
                <span className="w-28 text-right tabnum font-mono text-neutral-900">
                  {formatAmount(gaeldTotal)}
                </span>
              </li>
            </ReportTable>
          )}
        </section>

        {/* 50/30/20 */}
        {fiftyThirtyTwenty && (
          <section className="mt-8 break-inside-avoid">
            <SectionTitle>Fordeling (50/30/20)</SectionTitle>
            <p className="mb-3 text-xs text-neutral-500">
              Tommelfingerreglen: ca. 50% til behov (bolig, transport, mad,
              forsikring), 30% til forbrug og lyst, 20% til opsparing.
            </p>
            <div className="space-y-2.5">
              <BudgetBar
                label="Behov"
                amount={fiftyThirtyTwenty.needs}
                pct={fiftyThirtyTwenty.needsPct}
                target={50}
              />
              <BudgetBar
                label="Forbrug"
                amount={fiftyThirtyTwenty.wants}
                pct={fiftyThirtyTwenty.wantsPct}
                target={30}
              />
              <BudgetBar
                label="Opsparing"
                amount={fiftyThirtyTwenty.savings}
                pct={fiftyThirtyTwenty.savingsPct}
                target={20}
              />
            </div>
          </section>
        )}

        <footer className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-400">
          Genereret {formatLongDateDA(new Date())} via FamBud. Tallene er
          baseret på de konti du har adgang til (dine egne og husstandens
          fælles) og månedlige gennemsnit af tilbagevendende poster.
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

function BudgetBar({
  label,
  amount,
  pct,
  target,
}: {
  label: string;
  amount: number;
  pct: number;
  target: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-neutral-900">
          {label}{' '}
          <span className="text-xs font-normal text-neutral-400">
            (mål ca. {target}%)
          </span>
        </span>
        <span className="tabnum font-mono text-neutral-700">
          {formatAmount(amount)} kr · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-[#4B4D39]"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
