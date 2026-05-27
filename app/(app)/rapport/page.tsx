// /rapport - samlet finansrapport til bankmødet (og som personligt
// statusbillede). Ét komplet månedligt regnskab over husstandens FÆLLES
// økonomi: indkomst, faste udgifter, lån, husholdning, opsparing og det der
// reelt er frit til sidst.
//
// Print-optimeret: "Gem som PDF"-knappen åbner browserens print-dialog
// (window.print). App-chrome (sidebar, top-bar, beta-notice) er skjult i
// print via print:hidden i layout'et, så kun selve rapporten kommer med.
//
// Vigtige modelvalg (nemme at få galt i halsen):
//   - Husstandens indkomst = Σ income pr. konto fra cashflow-grafen (det
//     inkluderer løn-forecast, modsat getHouseholdFinancialSummary der kun
//     tæller tilbagevendende income).
//   - Faste udgifter bruger SAMME kilde som /budget (kun budget-konti:
//     checking/budget/other). Det holder husholdnings-konto-forbrug ude af
//     de faste udgifter - husholdning er en egen post. Tidligere lækkede det
//     ind som en "Andet"-post fordi getMonthlyExpensesByGroup ikke filtrerer
//     på kontotype.
//   - Låneydelser er bogført som "Bolig & lån"-udgifter; vi trækker låne-
//     andelen ud så de står som en egen post (ikke dobbelt).
//   - Husholdning = fælles forbrug på husholdnings-/kontantkonti.
//   - Opsparing = faste overførsler ind på opsparings-/investeringskonti.
//   - Private udgifter udelades: en bank vurderer husstandens fælles
//     forpligtelser, ikke den enkeltes private forbrug.

import {
  getEconomyPlanData,
  getCashflowGraph,
  getAccounts,
  getBudgetAccounts,
  getRecurringExpensesForAccount,
  getHouseholdName,
  getFamilyMembers,
  getPrimaryIncomeForecast,
} from '@/lib/dal';
import {
  formatAmount,
  formatMonthYearDA,
  formatLongDateDA,
  currentYearMonth,
  effectiveAmount,
  monthlyEquivalent,
} from '@/lib/format';
import { categoryGroupFor, type CategoryGroup } from '@/lib/categories';
import { FambudMark } from '@/app/_components/FambudMark';
import { PrintButton } from './_components/PrintButton';

export default async function RapportPage() {
  const [plan, graph, accounts, budgetAccounts, householdName, familyMembers] =
    await Promise.all([
      getEconomyPlanData(),
      getCashflowGraph(),
      getAccounts(),
      getBudgetAccounts(),
      getHouseholdName(),
      getFamilyMembers(),
    ]);

  // Husstandens samlede månedlige indkomst.
  let householdIncome = 0;
  for (const d of graph.perAccount.values()) householdIncome += d.income;

  const loanPaymentTotal = plan.loans.reduce((s, l) => s + l.monthlyPayment, 0);

  // Faste udgifter (fælles) fra SAMME kilde som /budget: kun budget-konti.
  // Grupperet pr. kategori-gruppe; låneandelen trækkes ud af Bolig & lån.
  const faellesBudgetExpenses = await Promise.all(
    budgetAccounts
      .filter((a) => a.owner_name === 'Fælles')
      .map((a) => getRecurringExpensesForAccount(a.id))
  );
  const faellesGroupMap = new Map<CategoryGroup, number>();
  for (const list of faellesBudgetExpenses) {
    for (const e of list) {
      const eff = effectiveAmount(e.amount, e.components, e.components_mode);
      const group = categoryGroupFor(e.category?.name ?? '');
      faellesGroupMap.set(
        group,
        (faellesGroupMap.get(group) ?? 0) + monthlyEquivalent(eff, e.recurrence)
      );
    }
  }
  const fasteGroups = Array.from(faellesGroupMap.entries())
    .map(([group, monthly]) =>
      group === 'Bolig & lån'
        ? { group, monthly: Math.max(0, monthly - loanPaymentTotal) }
        : { group, monthly }
    )
    .filter((g) => g.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly);
  const fixedExpensesExclLoans = fasteGroups.reduce((s, g) => s + g.monthly, 0);

  // Husholdning (fælles dagligt forbrug) + opsparing (faste overførsler ind
  // på opsparings-/investeringskonti) fra cashflow-grafen.
  let householdSpend = 0;
  const savingsAccounts: { id: string; name: string; monthly: number }[] = [];
  for (const a of accounts) {
    if (a.archived) continue;
    const d = graph.perAccount.get(a.id);
    if (!d) continue;
    if (a.kind === 'savings' || a.kind === 'investment') {
      if (d.transfersIn > 0)
        savingsAccounts.push({ id: a.id, name: a.name, monthly: d.transfersIn });
    } else if (
      a.owner_name === 'Fælles' &&
      (a.kind === 'household' || a.kind === 'cash')
    ) {
      householdSpend += d.expense;
    }
  }
  savingsAccounts.sort((a, b) => b.monthly - a.monthly);
  const savingsContrib = savingsAccounts.reduce((s, a) => s + a.monthly, 0);

  const raadighed =
    householdIncome -
    fixedExpensesExclLoans -
    loanPaymentTotal -
    householdSpend -
    savingsContrib;

  const gaeldTotal = plan.loans.reduce((s, l) => s + l.balance, 0);
  const annualNetIncome = householdIncome * 12;
  const gaeldRatioNet = annualNetIncome > 0 ? gaeldTotal / annualNetIncome : null;
  const friAndelPct =
    householdIncome > 0 ? Math.round((raadighed * 100) / householdIncome) : null;

  // Bruttoindkomst til den OFFICIELLE gældsfaktor (gæld ÷ bruttoårsindkomst).
  // Brutto kommer fra lønsedlernes gross_amount via forecastet, og vises kun
  // hvis brutto dækker ~hele husstandsindkomsten - ellers ville vi dele
  // gælden med en delvis bruttoindkomst og få et misvisende højt tal.
  const incomeForecasts = await Promise.all(
    plan.members.map(async (m) => ({
      net: m.monthlyIncome,
      forecast: await getPrimaryIncomeForecast(m.id),
    }))
  );
  let grossMonthly = 0;
  let netCoveredByGross = 0;
  for (const { net, forecast } of incomeForecasts) {
    if (forecast.status === 'ready' && forecast.monthlyGross != null) {
      grossMonthly += forecast.monthlyGross;
      netCoveredByGross += net;
    }
  }
  const grossComplete =
    grossMonthly > 0 && netCoveredByGross >= householdIncome * 0.9;
  const gaeldRatioGross = grossComplete ? gaeldTotal / (grossMonthly * 12) : null;
  const fmtRatio = (r: number) => `${r.toFixed(1).replace('.', ',')}×`;

  const monthLabel = formatMonthYearDA(currentYearMonth());
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const memberIncomeSum = plan.members.reduce((s, m) => s + m.monthlyIncome, 0);

  // Brevhoved: husstandens adresse fra første medlem der har den udfyldt.
  const addressMember = familyMembers.find((m) => m.home_address);
  const addressLine = addressMember
    ? [
        addressMember.home_address,
        [addressMember.home_zip_code, addressMember.home_city]
          .filter(Boolean)
          .join(' '),
      ]
        .filter((s) => s && s.trim())
        .join(', ')
    : null;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Brevhoved: logo + dokument-titel + husstandens identitet. Gem-som-
            PDF-knappen sidder øverst til højre og skjules i selve print'et. */}
        <header className="border-b border-neutral-200 pb-6">
          <div className="flex items-start justify-between gap-3">
            <FambudMark size="lg" />
            <div className="print:hidden">
              <PrintButton />
            </div>
          </div>
          <div className="mt-5">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              Finans Rapport
            </h1>
            <p className="mt-1.5 text-sm text-neutral-600">
              {householdName ?? 'Husstanden'} · {monthCap}
            </p>
            {addressLine && (
              <p className="mt-0.5 text-xs text-neutral-500">{addressLine}</p>
            )}
            {plan.members.length > 0 && (
              <p className="mt-0.5 text-xs text-neutral-400">
                {plan.members.map((m) => m.name).join(', ')}
              </p>
            )}
          </div>
        </header>

        {/* Nøgletal: de tal man kigger på først */}
        <section className="mt-6 break-inside-avoid">
          <SectionTitle>Nøgletal</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatTile
              label="Rådighedsbeløb"
              value={formatAmount(raadighed)}
              unit="kr/md"
              tone={raadighed > 0 ? 'positive' : raadighed < 0 ? 'negative' : 'neutral'}
              emphasis
            />
            <StatTile label="Gæld i alt" value={formatAmount(gaeldTotal)} unit="kr" />
            <div className="rounded-md border border-neutral-200 bg-white px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                Gældsfaktor
              </div>
              {gaeldRatioGross != null ? (
                <>
                  <div className="mt-1 tabnum font-mono text-lg font-semibold text-neutral-900">
                    {fmtRatio(gaeldRatioGross)}{' '}
                    <span className="text-xs font-normal text-neutral-400">brutto</span>
                  </div>
                  <div className="tabnum font-mono text-sm text-neutral-500">
                    {gaeldRatioNet != null ? fmtRatio(gaeldRatioNet) : '–'}{' '}
                    <span className="text-[10px] font-normal text-neutral-400">netto</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-1 tabnum font-mono text-lg font-semibold text-neutral-900">
                    {gaeldRatioNet != null ? fmtRatio(gaeldRatioNet) : '–'}
                  </div>
                  <div className="text-[10px] text-neutral-400">netto-årsindkomst</div>
                </>
              )}
            </div>
          </div>
          {gaeldRatioGross != null ? (
            <p className="mt-2 text-xs text-neutral-500">
              Gældsfaktor = samlet gæld ÷ årsindkomst. Vi viser den både på
              bruttoindkomst (den officielle definition, banken bruger) og på
              nettoindkomst.
            </p>
          ) : gaeldRatioNet != null ? (
            <p className="mt-2 text-xs text-neutral-500">
              Gældsfaktoren her er beregnet på nettoindkomst. Den officielle
              bruger bruttoindkomst (lavere tal). Udfyld bruttoløn på indkomst-
              siden for at få brutto-tallet med.
            </p>
          ) : null}
        </section>

        {/* Månedligt regnskab: hele pengestrømmen, krone for krone */}
        <section className="mt-8 break-inside-avoid">
          <SectionTitle>Månedligt regnskab</SectionTitle>
          <ul className="text-sm">
            <FlowRow label="Indkomst" amount={householdIncome} sign="+" />
            <FlowRow label="Faste udgifter" amount={fixedExpensesExclLoans} sign="−" />
            <FlowRow label="Låneydelser" amount={loanPaymentTotal} sign="−" />
            {householdSpend > 0 && (
              <FlowRow label="Husholdning" amount={householdSpend} sign="−" />
            )}
            {savingsContrib > 0 && (
              <FlowRow label="Opsparing" amount={savingsContrib} sign="−" />
            )}
            <FlowRow label="Rådighedsbeløb" amount={raadighed} sign="=" total />
          </ul>
          {friAndelPct != null && (
            <p className="mt-2 text-xs text-neutral-500">
              Rådighedsbeløbet er det reelt frie hver måned ({friAndelPct}% af
              indkomsten) - efter faste udgifter, lån, husholdning og opsparing.
            </p>
          )}
        </section>

        {/* Indkomst */}
        <section className="mt-8 break-inside-avoid">
          <SectionTitle>Indkomst</SectionTitle>
          <ul className="text-sm">
            {plan.members.map((m) => (
              <ReportRow
                key={m.id}
                label={m.name}
                note={m.incomeComplete ? undefined : 'estimat'}
                value={formatAmount(m.monthlyIncome)}
              />
            ))}
            <ReportRow label="Husstandens indkomst i alt" value={formatAmount(householdIncome)} total />
          </ul>
          {householdIncome > memberIncomeSum + 100 && (
            <p className="mt-2 text-xs text-neutral-500">
              Totalen inkluderer understøttelse, biindkomst og øvrige
              tilbagevendende indtægter ud over de viste lønforecast.
            </p>
          )}
        </section>

        {/* Faste udgifter - fælles budget-konti, ekskl. lån */}
        <section className="mt-8 break-inside-avoid">
          <SectionTitle>Faste udgifter</SectionTitle>
          <p className="mb-2 text-xs text-neutral-500">
            Husstandens fælles faste regninger pr. måned (samme som Budget),
            ekskl. låneydelser. Husholdning og opsparing står som egne poster i
            regnskabet ovenfor.
          </p>
          {fasteGroups.length === 0 ? (
            <p className="text-sm text-neutral-400">Ingen faste udgifter registreret.</p>
          ) : (
            <ul className="text-sm">
              {fasteGroups.map((g) => (
                <ReportRow key={g.group} label={g.group} value={formatAmount(g.monthly)} />
              ))}
              <ReportRow
                label="Faste udgifter i alt"
                value={formatAmount(fixedExpensesExclLoans)}
                total
              />
            </ul>
          )}
        </section>

        {/* Opsparing - faste overførsler til opsparings-/investeringskonti */}
        <section className="mt-8 break-inside-avoid">
          <SectionTitle>Opsparing</SectionTitle>
          {savingsAccounts.length === 0 ? (
            <p className="text-sm text-neutral-400">
              Ingen faste opsparings-overførsler registreret.
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-neutral-500">
                Faste månedlige overførsler til opsparings- og investeringskonti.
              </p>
              <ul className="text-sm">
                {savingsAccounts.map((s) => (
                  <ReportRow key={s.id} label={s.name} value={formatAmount(s.monthly)} />
                ))}
                <ReportRow label="Opsparing i alt" value={formatAmount(savingsContrib)} total />
              </ul>
            </>
          )}
        </section>

        {/* Lån - gældsoversigt */}
        <section className="mt-8 break-inside-avoid">
          <SectionTitle>Lån</SectionTitle>
          {plan.loans.length === 0 ? (
            <p className="text-sm text-neutral-400">Ingen lån registreret.</p>
          ) : (
            <ul className="text-sm">
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
                    {l.interestRate != null
                      ? `${l.interestRate.toFixed(2).replace('.', ',')}%`
                      : '–'}
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
            </ul>
          )}
          {plan.loans.length > 0 && (
            <p className="mt-2 text-xs text-neutral-500">
              Ydelserne ({formatAmount(loanPaymentTotal)} kr/md) er vist som egen
              post i regnskabet ovenfor. Restgælden indgår i gæld i alt.
            </p>
          )}
        </section>

        <footer className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-400">
          Genereret {formatLongDateDA(new Date())} via FamBud. Et komplet
          månedligt regnskab for husstandens fælles økonomi: indkomst, faste
          udgifter, lån, husholdning og opsparing. Private udgifter er udeladt.
          Beløb er månedlige gennemsnit af tilbagevendende poster.
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

// Række i det månedlige regnskab. sign styrer fortegnet foran beløbet:
// '+' indtægt, '−' fradrag, '=' resultat (rådighedsbeløb, fremhævet).
function FlowRow({
  label,
  amount,
  sign,
  total = false,
}: {
  label: string;
  amount: number;
  sign: '+' | '−' | '=';
  total?: boolean;
}) {
  return (
    <li
      className={`flex items-baseline justify-between gap-3 px-1 py-1.5 ${
        total
          ? 'mt-1 border-t-2 border-neutral-300 pt-2 font-semibold text-neutral-900'
          : 'text-neutral-700'
      }`}
    >
      <span>{label}</span>
      <span className="tabnum font-mono">
        {sign === '=' ? '' : `${sign} `}
        {formatAmount(amount)} kr
      </span>
    </li>
  );
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
