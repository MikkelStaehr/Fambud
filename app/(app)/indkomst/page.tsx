import Link from 'next/link';
import {
  Plus,
  Pencil,
  Trash2,
  Repeat,
  Sparkles,
  AlertTriangle,
  Coins,
  Copy,
} from 'lucide-react';
import {
  getFamilyMembers,
  getIncomeTransactions,
  getPrimaryIncomeForecast,
  type FamilyMemberRow,
  type IncomeRow,
  type PrimaryIncomeForecast,
} from '@/lib/dal';
import {
  RECURRENCE_LABEL_DA,
  formatAmount,
  formatShortDateDA,
  monthlyEquivalent,
} from '@/lib/format';
import { deleteIncome, setPrimaryIncomeSource } from './actions';

// /indkomst er nu delt i tre konceptuelle sektioner:
//
//   1. Hovedindkomst - én card pr. familiemedlem. Viser primary_income_source
//      (løn / understøttelse), forecast baseret på de 3 seneste lønudbetalinger,
//      og en liste over registrerede udbetalinger.
//
//   2. Biindkomst - alle income-transaktioner med income_role='secondary'
//      (freelance, B-skat, udbytte osv.). Simpel flad liste.
//
//   3. Uklassificeret - gamle income-poster fra før migration 0026 hvor
//      income_role er null. Brugeren bedes klassificere eller slette dem.
export default async function IndkomstPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const [allFamilyMembers, incomes] = await Promise.all([
    getFamilyMembers(),
    getIncomeTransactions(),
  ]);

  // Børn (begge user_id og email er null) har pr. definition ingen
  // hovedindkomst - de tjener ikke. Børneopsparingsindbetalinger gemmes
  // som transfers, ikke som income, så de hører ikke til her.
  // Vi viser kun voksne (logged-in eller pre-godkendt med email) i
  // Hovedindkomst-sektionen.
  const incomeContributors = allFamilyMembers.filter(
    (m) => m.user_id != null || m.email != null
  );

  // For hver person der har primary_income_source sat, forudbeg vi forecastet
  // i parallel så page-render ikke serialiserer N opslag.
  const forecasts = await Promise.all(
    incomeContributors
      .filter((m) => m.primary_income_source)
      .map(async (m) => ({ memberId: m.id, forecast: await getPrimaryIncomeForecast(m.id) }))
  );
  const forecastByMember = new Map(forecasts.map((f) => [f.memberId, f.forecast]));

  // Bucket-sorter income-rækker efter rolle.
  const primaryIncomes = incomes.filter((i) => i.income_role === 'primary');
  const secondaryIncomes = incomes.filter((i) => i.income_role === 'secondary');
  const unclassifiedIncomes = incomes.filter((i) => i.income_role == null);

  // Sum til header. Primary-paychecks bruger recurrence='once' så
  // monthlyEquivalent giver 0 - vi falder tilbage til forecast-summen
  // for dem og monthlyEquivalent for resten (sekundære recurrencer + biindkomst).
  const forecastSum = forecasts.reduce(
    (sum, f) => sum + (f.forecast.status === 'ready' ? f.forecast.monthlyNet : 0),
    0
  );
  const nonPrimaryMonthlySum = incomes
    .filter((i) => i.income_role !== 'primary')
    .reduce((sum, i) => sum + monthlyEquivalent(i.amount, i.recurrence), 0);
  const monthlyTotal = forecastSum + nonPrimaryMonthlySum;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 border-b border-neutral-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Indkomst
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {incomes.length === 0
              ? 'Ingen indkomstposter endnu'
              : `${incomes.length} ${incomes.length === 1 ? 'post' : 'poster'} · ${formatAmount(monthlyTotal)} kr/md i alt`}
          </p>
        </div>
      </header>

      {sp.error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      {/* Hovedindkomst - én card pr. familiemedlem */}
      <section className="mt-6">
        <h2 className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
          <Sparkles className="h-3 w-3" />
          Hovedindkomst
        </h2>
        {incomeContributors.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
            Tilføj voksne familiemedlemmer på{' '}
            <Link href="/indstillinger" className="underline hover:text-neutral-900">
              Indstillinger
            </Link>{' '}
            for at registrere hovedindkomst pr. person.
          </div>
        ) : (
          <div className="space-y-4">
            {incomeContributors.map((m) => (
              <HovedindkomstCard
                key={m.id}
                member={m}
                forecast={forecastByMember.get(m.id) ?? null}
                paychecks={primaryIncomes
                  .filter((i) => i.family_member_id === m.id)
                  .sort(
                    (a, b) => b.occurs_on.localeCompare(a.occurs_on)
                  )}
              />
            ))}
          </div>
        )}
      </section>

      {/* Biindkomster - flad liste */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
            <Coins className="h-3 w-3" />
            Biindkomst
          </h2>
          <Link
            href="/indkomst/ny?role=secondary"
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
          >
            <Plus className="h-3 w-3" />
            Tilføj biindkomst
          </Link>
        </div>
        {secondaryIncomes.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-4 text-center text-xs text-neutral-500">
            Ingen biindkomster registreret. B-skat, freelance, udbytte og lignende
            registreres her.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            <ul className="divide-y divide-neutral-100">
              {secondaryIncomes.map((i) => (
                <li key={i.id}>
                  <IncomeRowDisplay income={i} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Uklassificerede poster - kun synlig hvis nogen */}
      {unclassifiedIncomes.length > 0 && (
        <section className="mt-8">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="flex-1">
                <h2 className="text-sm font-medium text-amber-900">
                  {unclassifiedIncomes.length}{' '}
                  {unclassifiedIncomes.length === 1
                    ? 'indkomstpost ikke kategoriseret'
                    : 'indkomstposter ikke kategoriseret'}
                </h2>
                <p className="mt-0.5 text-sm text-amber-800">
                  Disse poster er fra før vi indførte hovedindkomst/biindkomst-
                  skellet. Rediger dem og marker dem som primær (hovedindkomst -
                  løn/understøttelse) eller sekundær (biindkomst). Alternativt slet dem
                  hvis de er forældede.
                </p>
              </div>
            </div>
            <ul className="mt-3 divide-y divide-amber-200 rounded-md border border-amber-200 bg-white">
              {unclassifiedIncomes.map((i) => (
                <li key={i.id}>
                  <IncomeRowDisplay income={i} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

// Card pr. familiemedlem under "Hovedindkomst". Viser kilde-vælger hvis ikke
// sat, ellers forecast + lønudbetalinger.
function HovedindkomstCard({
  member,
  forecast,
  paychecks,
}: {
  member: FamilyMemberRow;
  forecast: PrimaryIncomeForecast | null;
  paychecks: IncomeRow[];
}) {
  const sourceLabel =
    member.primary_income_source === 'salary'
      ? 'Løn'
      : member.primary_income_source === 'benefits'
        ? 'Understøttelse'
        : null;

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">{member.name}</span>
          {sourceLabel && (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
              {sourceLabel}
            </span>
          )}
          {!member.user_id && member.email && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-800">
              Pre-godkendt
            </span>
          )}
        </div>
        {/* Inline kilde-vælger. Submit ved change er bevidst - sparer en
            ekstra "Gem"-klik. Det er én select med klare valg. */}
        <form action={setPrimaryIncomeSource} className="flex items-center gap-2">
          <input type="hidden" name="family_member_id" value={member.id} />
          <label className="text-xs text-neutral-500" htmlFor={`src-${member.id}`}>
            Kilde:
          </label>
          <select
            id={`src-${member.id}`}
            name="primary_income_source"
            defaultValue={member.primary_income_source ?? ''}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          >
            <option value="">- Vælg -</option>
            <option value="salary">Løn</option>
            <option value="benefits">Understøttelse</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white transition hover:bg-emerald-700"
          >
            Gem
          </button>
        </form>
      </div>

      {/* Tilstand 1: kilde ikke valgt */}
      {!member.primary_income_source && (
        <p className="mt-3 text-sm text-neutral-500">
          Vælg om {member.name} primært modtager løn eller understøttelse -
          så kan vi vise det rigtige flow til at registrere udbetalinger.
        </p>
      )}

      {/* Tilstand 2: understøttelse - kommer senere */}
      {member.primary_income_source === 'benefits' && (
        <div className="mt-3 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-500">
          Understøttelses-flow er endnu ikke bygget. Indtil videre kan du
          registrere ydelser som biindkomst eller bruge "Tilføj indkomst" med
          tilpasset frekvens.
        </div>
      )}

      {/* Tilstand 3: løn - vis forecast + samples */}
      {member.primary_income_source === 'salary' && forecast && (
        <SalaryForecastView
          memberId={member.id}
          memberName={member.name}
          forecast={forecast}
          paychecks={paychecks}
        />
      )}
    </div>
  );
}

function SalaryForecastView({
  memberId,
  memberName,
  forecast,
  paychecks,
}: {
  memberId: string;
  memberName: string;
  forecast: PrimaryIncomeForecast;
  paychecks: IncomeRow[];
}) {
  const newPaycheckHref = `/indkomst/ny?role=primary&recurrence=once&member=${encodeURIComponent(memberId)}`;

  return (
    <div className="mt-4">
      {/* Forecast-status badge */}
      {forecast.status === 'ready' ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-emerald-900">
              Forecast: {formatAmount(forecast.monthlyNet)} kr/md netto
              {forecast.monthlyGross && (
                <span className="ml-1.5 text-xs font-normal text-emerald-700">
                  (brutto {formatAmount(forecast.monthlyGross)} kr/md)
                </span>
              )}
            </div>
            <span className="text-[11px] text-emerald-700">
              gennemsnit af {forecast.paychecksUsed} seneste lønudbetalinger
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
          <div className="text-sm font-medium text-amber-900">
            {forecast.paychecksUsed} ud af {forecast.paychecksNeeded}{' '}
            lønudbetalinger registreret
          </div>
          <p className="mt-0.5 text-xs text-amber-800">
            Vi mangler {forecast.paychecksNeeded - forecast.paychecksUsed}{' '}
            udbetaling{forecast.paychecksNeeded - forecast.paychecksUsed === 1 ? '' : 'er'}{' '}
            før vi kan forudsige din månedlige indkomst.
          </p>
        </div>
      )}

      {/* Liste over alle primary-poster (samples + evt. recurring) */}
      {paychecks.length > 0 && (
        <div className="mt-3">
          <h3 className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            Lønudbetalinger
          </h3>
          <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
            {paychecks.map((p) => (
              <li key={p.id}>
                <IncomeRowDisplay income={p} compact />
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href={newPaycheckHref}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
      >
        <Plus className="h-3.5 w-3.5" />
        Registrer lønudbetaling for {memberName}
      </Link>
    </div>
  );
}

// Genbrugelig række til at vise en income-transaktion. compact=true bruges
// inde i hovedindkomst-cards hvor familiemedlem-tag'et er overflødigt
// (kontoens ejer er allerede vist på card-titlen).
function IncomeRowDisplay({
  income: i,
  compact = false,
}: {
  income: IncomeRow;
  compact?: boolean;
}) {
  const monthly =
    i.recurrence === 'monthly' || i.recurrence === 'once'
      ? null
      : monthlyEquivalent(i.amount, i.recurrence);

  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-neutral-900">
            {i.description ?? 'Indkomst'}
          </span>
          {!compact && i.family_member && (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
              {i.family_member.name}
            </span>
          )}
          {i.recurrence !== 'once' && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
              <Repeat className="h-3 w-3" />
              {RECURRENCE_LABEL_DA[i.recurrence]}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-neutral-500">
          {i.account?.name ?? 'Ukendt konto'} · {formatShortDateDA(i.occurs_on)}
          {i.gross_amount != null && (
            <> · brutto {formatAmount(i.gross_amount)} kr</>
          )}
          {i.pension_own_pct != null && (
            <> · pension egen {i.pension_own_pct}%</>
          )}
          {i.other_deduction_amount != null && i.other_deduction_amount > 0 && (
            <>
              {' · '}
              {i.other_deduction_label ?? 'fradrag'}{' '}
              {formatAmount(i.other_deduction_amount)}
            </>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
        <div className="text-right">
          <div className="font-mono tabnum text-sm font-semibold text-emerald-700">
            {formatAmount(i.amount)} kr
          </div>
          {monthly != null && (
            <div className="mt-0.5 text-[11px] text-neutral-500">
              {formatAmount(monthly)} kr/md
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* Duplikér: én klik kopierer hele rækken og foreslår én måned
              bagud som ny dato. Bruges typisk når 2-3 lønninger i træk er
              identiske og brugeren ellers skulle indtaste dem manuelt for
              at få nok forecast-samples. */}
          <Link
            href={`/indkomst/ny?duplicate=${encodeURIComponent(i.id)}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
            title="Duplikér"
            aria-label={`Duplikér ${i.description ?? 'indkomst'}`}
          >
            <Copy className="h-3 w-3" />
            <span className="hidden sm:inline">Duplikér</span>
          </Link>
          <Link
            href={`/indkomst/${i.id}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
            title="Rediger"
            aria-label={`Rediger ${i.description ?? 'indkomst'}`}
          >
            <Pencil className="h-3 w-3" />
            <span className="hidden sm:inline">Rediger</span>
          </Link>
          <form action={deleteIncome}>
            <input type="hidden" name="id" value={i.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-red-50 hover:text-red-700"
              aria-label={`Slet ${i.description ?? 'indkomst'}`}
            >
              <Trash2 className="h-3 w-3" />
              <span className="hidden sm:inline">Slet</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
