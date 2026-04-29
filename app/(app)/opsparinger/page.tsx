// /opsparinger — den tredje del af "budget-treenigheden":
//   1. Faste udgifter (/budget) — det der trækkes hver måned
//   2. Husholdning (/husholdning) — daily-spend tracking
//   3. Opsparinger & buffer (denne side) — det der lægges til side
//
// Sidens opbygning:
//   - Anbefalede opsparinger (ØVERST) — to "must-have"-konti vi aktivt
//     foreslår: Buffer Konto og Forudsigelige uforudsete. Hver med beregnet
//     målbeløb baseret på brugerens egne tal (faste udgifter, nettoindkomst).
//     Hvis konto ikke findes: prompt om at oprette. Hvis findes: vis
//     overførsels-status.
//   - Alle opsparinger (NEDERST) — konventionel liste over alle
//     opsparings/investeringskonti med deres månedlige indskud.
//
// Buffer + predictable_unexpected er identificeret via accounts.savings_purpose
// (migration 0025) — ikke via navne — så det er robust uanset hvad brugeren
// kalder kontoen.

import Link from 'next/link';
import {
  ArrowRight,
  Plus,
  PiggyBank,
  AlertCircle,
  Check,
  Shield,
  CalendarRange,
} from 'lucide-react';
import {
  getHouseholdFinancialSummary,
  getSavingsAccountsWithFlow,
  type SavingsAccountWithFlow,
} from '@/lib/dal';
import {
  ACCOUNT_KIND_LABEL_DA,
  INVESTMENT_TYPE_LABEL_DA,
  SAVINGS_PURPOSE_DESC_DA,
  SAVINGS_PURPOSE_LABEL_DA,
  formatAmount,
} from '@/lib/format';
import type { SavingsPurpose } from '@/lib/database.types';

export default async function OpsparingerPage() {
  const [savings, summary] = await Promise.all([
    getSavingsAccountsWithFlow(),
    getHouseholdFinancialSummary(),
  ]);

  const totalInflow = savings.reduce((s, a) => s + a.monthlyInflow, 0);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-200 pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Opsparinger & buffer
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {savings.length === 0
                ? 'Ingen opsparingskonti endnu'
                : `${savings.length} konti · ${formatAmount(totalInflow)} kr/md sættes til side`}
            </p>
          </div>
          <Link
            href="/konti/ny"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <Plus className="h-4 w-4" />
            Ny konto
          </Link>
        </div>
      </header>

      {/* Anbefalede konti — det vigtige er at brugeren VED de bør have
          disse. Vi viser dem altid, uanset om brugeren har dem eller ej. */}
      <RecommendedSection savings={savings} summary={summary} />

      {/* Alle opsparinger */}
      <section className="mt-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Alle opsparingskonti
        </h2>
        {savings.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <PiggyBank className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-sm text-neutral-500">
              Ingen opsparings- eller investeringskonti endnu.
            </p>
            <Link
              href="/konti/ny"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              <Plus className="h-4 w-4" />
              Opret konto
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {savings.map((s) => (
              <SavingsCard key={s.id} account={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Anbefalede opsparinger
// ----------------------------------------------------------------------------

function RecommendedSection({
  savings,
  summary,
}: {
  savings: SavingsAccountWithFlow[];
  summary: { monthlyNetIncome: number; monthlyFixedExpenses: number };
}) {
  // Buffer-mål: 3 mdr × faste udgifter (minimum), 6 mdr × samme (godt niveau).
  const bufferMin = summary.monthlyFixedExpenses * 3;
  const bufferGood = summary.monthlyFixedExpenses * 6;

  // Forudsigelige uforudsete: 15% af nettoindkomst pr. år. Vi viser BÅDE
  // det årlige tal og hvad det svarer til pr. måned (1.8 × monthly net /12 =
  // monthly net × 0.15).
  const predictableYearly = Math.round(summary.monthlyNetIncome * 12 * 0.15);
  const predictableMonthly = Math.round(summary.monthlyNetIncome * 0.15);

  const bufferAccount = savings.find((a) => a.savings_purpose === 'buffer');
  const predictableAccount = savings.find(
    (a) => a.savings_purpose === 'predictable_unexpected'
  );

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
        Anbefalede opsparinger
      </h2>
      <p className="mb-4 max-w-2xl text-xs text-neutral-500">
        To opsparinger vi anbefaler at I prioriterer — beregnet ud fra jeres
        egne tal. De øvrige (aldersopsparing, aktiesparekonto, ferieopsparing
        mv.) er nice-to-have; disse er fundamentet.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        <BufferCard
          account={bufferAccount}
          minTarget={bufferMin}
          goodTarget={bufferGood}
          monthlyFixedExpenses={summary.monthlyFixedExpenses}
        />
        <PredictableCard
          account={predictableAccount}
          monthlyTarget={predictableMonthly}
          yearlyTarget={predictableYearly}
          monthlyNetIncome={summary.monthlyNetIncome}
        />
      </div>
    </section>
  );
}

function BufferCard({
  account,
  minTarget,
  goodTarget,
  monthlyFixedExpenses,
}: {
  account: SavingsAccountWithFlow | undefined;
  minTarget: number;
  goodTarget: number;
  monthlyFixedExpenses: number;
}) {
  const purpose: SavingsPurpose = 'buffer';
  const hasData = monthlyFixedExpenses > 0;

  return (
    <RecommendedCard
      icon={<Shield className="h-5 w-5" />}
      iconTone="bg-blue-50 text-blue-700"
      label={SAVINGS_PURPOSE_LABEL_DA[purpose]}
      description={SAVINGS_PURPOSE_DESC_DA[purpose]}
      account={account}
      purposeQuery={purpose}
    >
      {hasData ? (
        <div className="space-y-1.5 text-xs">
          <TargetRow label="Minimum (3 mdr)" amount={minTarget} />
          <TargetRow label="Godt niveau (6 mdr)" amount={goodTarget} />
          <p className="mt-2 text-[11px] text-neutral-500">
            Baseret på jeres faste udgifter på{' '}
            <span className="tabnum font-mono">
              {formatAmount(monthlyFixedExpenses)}
            </span>{' '}
            kr/md.
          </p>
        </div>
      ) : (
        <p className="text-xs text-amber-700">
          Indtast jeres faste udgifter på{' '}
          <Link href="/budget" className="underline">
            Faste udgifter
          </Link>{' '}
          så kan vi beregne målet.
        </p>
      )}
    </RecommendedCard>
  );
}

function PredictableCard({
  account,
  monthlyTarget,
  yearlyTarget,
  monthlyNetIncome,
}: {
  account: SavingsAccountWithFlow | undefined;
  monthlyTarget: number;
  yearlyTarget: number;
  monthlyNetIncome: number;
}) {
  const purpose: SavingsPurpose = 'predictable_unexpected';
  const hasData = monthlyNetIncome > 0;

  return (
    <RecommendedCard
      icon={<CalendarRange className="h-5 w-5" />}
      iconTone="bg-violet-50 text-violet-700"
      label={SAVINGS_PURPOSE_LABEL_DA[purpose]}
      description={SAVINGS_PURPOSE_DESC_DA[purpose]}
      account={account}
      purposeQuery={purpose}
    >
      {hasData ? (
        <div className="space-y-1.5 text-xs">
          <TargetRow label="Pr. måned (15%)" amount={monthlyTarget} />
          <TargetRow label="Pr. år (15%)" amount={yearlyTarget} />
          <p className="mt-2 text-[11px] text-neutral-500">
            Baseret på husstandens nettoindkomst på{' '}
            <span className="tabnum font-mono">
              {formatAmount(monthlyNetIncome)}
            </span>{' '}
            kr/md.
          </p>
        </div>
      ) : (
        <p className="text-xs text-amber-700">
          Indtast jeres indkomst på{' '}
          <Link href="/indkomst" className="underline">
            Indkomst
          </Link>{' '}
          så kan vi beregne målet.
        </p>
      )}
    </RecommendedCard>
  );
}

// Fælles wrapper for både buffer og predictable. Håndterer status-banner
// (har-konto vs mangler) og CTA-knap. Children renderer det specifikke
// indhold for hver type.
function RecommendedCard({
  icon,
  iconTone,
  label,
  description,
  account,
  purposeQuery,
  children,
}: {
  icon: React.ReactNode;
  iconTone: string;
  label: string;
  description: string;
  account: SavingsAccountWithFlow | undefined;
  purposeQuery: SavingsPurpose;
  children: React.ReactNode;
}) {
  const isShared = account?.owner_name === 'Fælles';

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded ${iconTone}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-neutral-900">{label}</h3>
          <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
        </div>
      </div>

      <div className="mt-4 border-t border-neutral-100 pt-3">{children}</div>

      <div className="mt-4 border-t border-neutral-100 pt-3">
        {account ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                <Check className="h-3 w-3" />
                <span className="font-medium">Konto sat op:</span>
                <span className="truncate text-neutral-900">{account.name}</span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    isShared
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {account.owner_name ?? 'Personlig'}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">
                {account.monthlyInflow > 0
                  ? `Overfører ${formatAmount(account.monthlyInflow)} kr/md`
                  : 'Mangler månedlig overførsel'}
              </div>
            </div>
            <Link
              href={
                account.monthlyInflow > 0
                  ? '/overforsler'
                  : `/overforsler/ny?to=${encodeURIComponent(account.id)}&recurrence=monthly&description=${encodeURIComponent('Til ' + account.name)}`
              }
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              {account.monthlyInflow > 0 ? 'Justér' : 'Sæt op'}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-amber-700">
              <AlertCircle className="h-3 w-3" />
              <span className="font-medium">
                Ingen konto sat op til denne specialfunktion
              </span>
            </div>
            <Link
              href={`/konti/ny?kind=savings&savings_purpose=${purposeQuery}`}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-neutral-800"
            >
              Opret konto
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function TargetRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-neutral-600">{label}</span>
      <span className="tabnum font-mono font-semibold text-neutral-900">
        {formatAmount(amount)} kr
      </span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Almindelige opsparings-kort (alle konti)
// ----------------------------------------------------------------------------

function SavingsCard({ account }: { account: SavingsAccountWithFlow }) {
  const isShared = account.owner_name === 'Fælles';
  const hasInflow = account.monthlyInflow > 0;
  const subtypeLabel = account.investment_type
    ? INVESTMENT_TYPE_LABEL_DA[account.investment_type]
    : account.savings_purpose
      ? SAVINGS_PURPOSE_LABEL_DA[account.savings_purpose]
      : ACCOUNT_KIND_LABEL_DA[account.kind] ?? account.kind;

  const href = hasInflow
    ? `/overforsler`
    : `/overforsler/ny?to=${encodeURIComponent(account.id)}&recurrence=monthly&description=${encodeURIComponent('Til ' + account.name)}`;

  return (
    <Link
      href={href}
      className="group rounded-md border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PiggyBank className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="truncate text-sm font-semibold text-neutral-900">
              {account.name}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-neutral-500">{subtypeLabel}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                isShared
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-neutral-100 text-neutral-700'
              }`}
            >
              {account.owner_name ?? 'Personlig'}
            </span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300 transition group-hover:text-neutral-700" />
      </div>

      <div className="mt-4 border-t border-neutral-100 pt-3">
        {hasInflow ? (
          <>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700">
              <Check className="h-3 w-3" />
              <span className="font-medium">Månedlig overførsel sat op</span>
            </div>
            <div className="mt-0.5 font-mono tabnum text-base font-semibold text-neutral-900">
              +{formatAmount(account.monthlyInflow)} kr/md
            </div>
            <div className="font-mono tabnum text-xs text-neutral-500">
              {formatAmount(account.monthlyInflow * 12)} kr/år
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-xs text-amber-700">
              <AlertCircle className="h-3 w-3" />
              <span className="font-medium">Mangler overførsel</span>
            </div>
            <div className="mt-0.5 text-xs text-neutral-500">
              Klik for at sætte op et månedligt indskud
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
