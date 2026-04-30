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
// Buffer + predictable_unexpected er identificeret via accounts.savings_purposes
// (migration 0029, omdøbt fra savings_purpose). Det er nu et array, så ÉN
// konto kan dække begge formål samtidig — typisk for familier der har én
// "Bufferkonto" til både nødfond og forudsigelige uforudsete.

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
  getPredictableEstimates,
  getSavingsAccountsWithFlow,
  sumYearlyEstimates,
  type SavingsAccountWithFlow,
} from '@/lib/dal';
import type { PredictableEstimate } from '@/lib/database.types';
import {
  ACCOUNT_KIND_LABEL_DA,
  INVESTMENT_TYPE_LABEL_DA,
  SAVINGS_PURPOSE_DESC_DA,
  SAVINGS_PURPOSE_LABEL_DA,
  formatAmount,
} from '@/lib/format';
import type { SavingsPurpose } from '@/lib/database.types';

export default async function OpsparingerPage() {
  const [savings, summary, predictableEstimates] = await Promise.all([
    getSavingsAccountsWithFlow(),
    getHouseholdFinancialSummary(),
    getPredictableEstimates(),
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
      <RecommendedSection
        savings={savings}
        summary={summary}
        predictableEstimates={predictableEstimates}
      />

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
  predictableEstimates,
}: {
  savings: SavingsAccountWithFlow[];
  summary: { monthlyNetIncome: number; monthlyFixedExpenses: number };
  predictableEstimates: PredictableEstimate[];
}) {
  // Find første konto med hvert tag. En konto kan have BEGGE tags — så
  // bufferAccount og predictableAccount kan pege på samme konto. Det er
  // bevidst: brugeren kan tagge én konto med begge formål.
  const bufferAccount = savings.find((a) =>
    a.savings_purposes?.includes('buffer')
  );
  const predictableAccount = savings.find((a) =>
    a.savings_purposes?.includes('predictable_unexpected')
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
          monthlyFixedExpenses={summary.monthlyFixedExpenses}
        />
        <PredictableCard
          account={predictableAccount}
          estimates={predictableEstimates}
        />
      </div>
    </section>
  );
}

function BufferCard({
  account,
  monthlyFixedExpenses,
}: {
  account: SavingsAccountWithFlow | undefined;
  monthlyFixedExpenses: number;
}) {
  const purpose: SavingsPurpose = 'buffer';
  const hasData = monthlyFixedExpenses > 0;
  const currentInflow = account?.monthlyInflow ?? 0;
  // 3-mdr-mål er den "minimum"-tærskel vi viser på oversigten — det er
  // tommelfingerreglens første milepæl. Detail-siden har den fulde tabel
  // med 1/3/6/12 mdr.
  const target3mdr = monthlyFixedExpenses * 3;
  const monthsTo3mdr =
    currentInflow > 0 && hasData ? Math.ceil(target3mdr / currentInflow) : null;
  const isSetUp = currentInflow > 0;

  return (
    <RecommendedCard
      icon={<Shield className="h-5 w-5" />}
      iconTone="bg-emerald-50 text-emerald-800"
      label={SAVINGS_PURPOSE_LABEL_DA[purpose]}
      description={SAVINGS_PURPOSE_DESC_DA[purpose]}
      account={account}
      purposeQuery={purpose}
    >
      <div className="space-y-3 text-xs">
        {hasData ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-800">
              3 måneders dækning
            </div>
            <div className="mt-1 tabnum font-mono text-2xl font-semibold text-emerald-900">
              {formatAmount(target3mdr)} kr
            </div>
            <p className="mt-1 text-[11px] text-emerald-800">
              Faste udgifter på {formatAmount(monthlyFixedExpenses)} kr/md ×
              3. Detail-siden har den fulde tabel for 1, 3, 6 og 12 mdr.
            </p>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3 text-[11px] text-neutral-600">
            Vi kan ikke beregne målene endnu — tilføj jeres faste udgifter
            på Faste udgifter først.
          </p>
        )}

        {isSetUp && monthsTo3mdr != null && (
          <p className="text-[11px] text-neutral-600">
            I overfører{' '}
            <span className="tabnum font-mono font-medium text-neutral-900">
              {formatAmount(currentInflow)}
            </span>{' '}
            kr/md → 3-mdr-målet nås på{' '}
            <span className="font-medium">
              {monthsTo3mdr < 12
                ? `${monthsTo3mdr} mdr`
                : `${Math.floor(monthsTo3mdr / 12)} år${monthsTo3mdr % 12 ? `, ${monthsTo3mdr % 12} mdr` : ''}`}
            </span>
            .
          </p>
        )}

        <Link
          href="/opsparinger/buffer"
          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          {isSetUp ? 'Se kalkulator' : 'Sæt buffer op'}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </RecommendedCard>
  );
}

function PredictableCard({
  account,
  estimates,
}: {
  account: SavingsAccountWithFlow | undefined;
  estimates: PredictableEstimate[];
}) {
  const purpose: SavingsPurpose = 'predictable_unexpected';

  // Beregn anbefaling fra konkrete kategorier (ikke en abstrakt %-regel).
  // Sum af årlige estimater / 12 = månedligt indskud.
  const yearlyTotal = sumYearlyEstimates(estimates);
  const monthlyRecommend = Math.round(yearlyTotal / 12 / 100) * 100; // hele 100 kr
  const hasEstimates = estimates.length > 0 && yearlyTotal > 0;
  const currentInflow = account?.monthlyInflow ?? 0;
  const meetsRecommendation =
    monthlyRecommend > 0 && currentInflow >= monthlyRecommend * 0.9;

  return (
    <RecommendedCard
      icon={<CalendarRange className="h-5 w-5" />}
      iconTone="bg-amber-50 text-amber-800"
      label={SAVINGS_PURPOSE_LABEL_DA[purpose]}
      description={SAVINGS_PURPOSE_DESC_DA[purpose]}
      account={account}
      purposeQuery={purpose}
    >
      <div className="space-y-3 text-xs">
        {hasEstimates ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-amber-800">
              Anbefalet månedligt indskud
            </div>
            <div className="mt-1 tabnum font-mono text-2xl font-semibold text-amber-900">
              {formatAmount(monthlyRecommend)} kr
            </div>
            <p className="mt-1 text-[11px] text-amber-800">
              {formatAmount(yearlyTotal)} kr/år fordelt på 12 måneder, baseret
              på {estimates.length}{' '}
              {estimates.length === 1 ? 'kategori' : 'kategorier'} I har sat op.
            </p>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3 text-[11px] text-neutral-600">
            Sæt jeres egne kategorier op for at få et konkret månedligt
            beløb — hvad bruger I om året på gaver, tandlæge, bilvedligehold
            og lignende?
          </p>
        )}

        {currentInflow > 0 && monthlyRecommend > 0 && (
          <p className="text-[11px] text-neutral-600">
            I overfører{' '}
            <span className="tabnum font-mono font-medium text-neutral-900">
              {formatAmount(currentInflow)}
            </span>{' '}
            kr/md →{' '}
            {meetsRecommendation
              ? 'I er på sporet ✓'
              : `${formatAmount(monthlyRecommend - currentInflow)} kr/md mangler`}
          </p>
        )}

        {/* CTA til detail-siden hvor selve værktøjet bor — hold oversigten
            ren. Tekst skifter alt efter om brugeren har sat noget op. */}
        <Link
          href="/opsparinger/forudsigelige"
          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          {hasEstimates ? 'Rediger kategorier' : 'Sæt kategorier op'}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
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
                      ? 'bg-emerald-50 text-emerald-800'
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
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            <div className="flex-1 text-[11px] text-neutral-600">
              <span className="font-medium text-neutral-700">
                Ingen konto linket.
              </span>{' '}
              Værktøjet virker uafhængigt — pengene kan stå hvor som helst.
              Link en dedikeret konto hvis I vil tracke månedlige indskud.
            </div>
            <Link
              href={`/konti/ny?kind=savings&savings_purposes=${purposeQuery}`}
              className="shrink-0 inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Opret eller link konto
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Almindelige opsparings-kort (alle konti)
// ----------------------------------------------------------------------------

function SavingsCard({ account }: { account: SavingsAccountWithFlow }) {
  const isShared = account.owner_name === 'Fælles';
  const hasInflow = account.monthlyInflow > 0;
  // Hvis kontoen har flere savings_purposes (typisk Buffer + Forudsigelige
  // på samme konto) viser vi en kombineret label "Buffer + Forudsigelige
  // uforudsete". Det fortæller brugeren tydeligt at kontoen serverer begge
  // formål.
  const purposeLabel =
    account.savings_purposes && account.savings_purposes.length > 0
      ? account.savings_purposes
          .map((p) => SAVINGS_PURPOSE_LABEL_DA[p])
          .join(' + ')
      : null;
  const subtypeLabel = account.investment_type
    ? INVESTMENT_TYPE_LABEL_DA[account.investment_type]
    : purposeLabel
      ? purposeLabel
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
                  ? 'bg-emerald-50 text-emerald-800'
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
        ) : account.savings_purposes && account.savings_purposes.length > 0 ? (
          // Must-have savings (buffer / forudsigelige uforudsete) uden
          // overførsel = ægte advarsel. Det er fundamentet brugeren bør have.
          <>
            <div className="flex items-center gap-1.5 text-xs text-amber-700">
              <AlertCircle className="h-3 w-3" />
              <span className="font-medium">Mangler overførsel</span>
            </div>
            <div className="mt-0.5 text-xs text-neutral-500">
              Klik for at sætte op et månedligt indskud
            </div>
          </>
        ) : (
          // Nice-to-have savings (aktiedepot, aldersopsparing, ASK, ...) uden
          // overførsel = neutral information, ikke en advarsel. Brugeren har
          // måske aktivt valgt at lade kontoen ligge stille (fx ASK der er
          // fyldt op til loftet, eller aktiedepot man kun handler i ad hoc).
          <>
            <div className="text-xs text-neutral-500">
              Ingen fast overførsel
            </div>
            <div className="mt-0.5 text-xs text-neutral-400">
              Klik for at sætte op et månedligt indskud, hvis det er ønsket.
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
