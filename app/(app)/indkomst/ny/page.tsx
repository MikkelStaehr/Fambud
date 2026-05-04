import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  getAccounts,
  getFamilyMembers,
  getIncomeById,
  getMostRecentPaycheck,
} from '@/lib/dal';
import { IncomeForm } from '../_components/IncomeForm';
import { createIncome } from '../actions';
import type { IncomeRole, RecurrenceFreq } from '@/lib/database.types';

// Beregn datoen én måned før en given ISO-dato. JS Date overflower fremad
// hvis target-måneden har færre dage (fx 31. maj → 30. april), så vi
// klamper dagen til target-månedens sidste dag. Bruges i ?duplicate-flow
// til at foreslå en fornuftig default-dato på den nye udbetaling.
function previousMonthIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const targetMonth = m - 1;
  const targetYear = targetMonth < 1 ? y - 1 : y;
  const finalMonth = targetMonth < 1 ? 12 : targetMonth;
  const lastDayOfTarget = new Date(targetYear, finalMonth, 0).getDate();
  const finalDay = Math.min(d, lastDayOfTarget);
  return `${targetYear}-${String(finalMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
}

// Search-params styrer hvilket flow brugeren kommer fra:
//   ?role=primary&recurrence=once&member=X  → "Registrer lønudbetaling"
//     (én faktisk udbetaling der bliver brugt som forecast-sample)
//   ?duplicate=<incomeId>                   → "Duplikér" - pre-fylder ALLE
//     felter fra en eksisterende post (også netto), kun datoen shifts én
//     måned bagud. Til når flere lønninger i træk er identiske.
//   default                                 → almindelig "Tilføj indkomst"
//     (uklassificeret eller biindkomst - brugeren vælger frit)
export default async function NyIndkomstPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    role?: string;
    recurrence?: string;
    member?: string;
    duplicate?: string;
  }>;
}) {
  const sp = await searchParams;
  const [accounts, familyMembers] = await Promise.all([
    getAccounts(),
    getFamilyMembers(),
  ]);

  // Duplikér-flow: hvis brugeren klikkede "Duplikér" på en eksisterende post,
  // henter vi den fulde række så vi kan pre-fylde alt - inkl. netto, brutto,
  // beskrivelse osv. Kun dato'en justeres (én måned bagud).
  const duplicateSource = sp.duplicate
    ? await getIncomeById(sp.duplicate).catch(() => null)
    : null;

  // Når vi duplikerer en primary-paycheck arver vi rolle/member/recurrence
  // fra kilden - query-params er sekundære.
  const role: IncomeRole | null = duplicateSource
    ? duplicateSource.income_role
    : sp.role === 'primary' || sp.role === 'secondary'
      ? sp.role
      : null;
  const isPaycheckFlow =
    role === 'primary' &&
    (duplicateSource ? duplicateSource.recurrence === 'once' : sp.recurrence === 'once');
  const recurrenceDefault: RecurrenceFreq | undefined = duplicateSource
    ? duplicateSource.recurrence
    : sp.recurrence === 'once'
      ? 'once'
      : undefined;
  const memberId = duplicateSource?.family_member_id ?? sp.member;

  // I paycheck-flow forsøger vi at hente medlemmets seneste lønudbetaling
  // og pre-fylde brutto, pension, trækprocent, skattefradrag og konto fra
  // den. Det er den ene ting der ændrer sig sjældent - næsten alt undtagen
  // dato + netto er konstant fra måned til måned. Returnerer null hvis det
  // er medlemmets første registrering. Springes over når vi duplikerer -
  // duplikat-kilden er en mere specifik default.
  const recentDefaults =
    !duplicateSource && isPaycheckFlow && memberId
      ? await getMostRecentPaycheck(memberId)
      : null;

  // Default-konto: prefer duplikat-kildens konto, ellers seneste lønudbetalings
  // konto, ellers medlemmets lønkonto baseret på heuristikker.
  const member = memberId
    ? familyMembers.find((m) => m.id === memberId)
    : null;
  const defaultAccountId =
    duplicateSource?.account_id ??
    recentDefaults?.account_id ??
    (isPaycheckFlow
      ? (
          // 1. konto oprettet af medlemmet selv
          accounts.find(
            (a) => a.kind === 'checking' && a.created_by === member?.user_id
          )
          // 2. fald tilbage til konto med owner_name = medlemmets fornavn
          ?? accounts.find(
            (a) =>
              a.kind === 'checking' &&
              a.owner_name?.split(/\s+/)[0] === member?.name.split(/\s+/)[0]
          )
          // 3. sidste fallback: første checking-konto i husstanden
          ?? accounts.find((a) => a.kind === 'checking')
        )?.id
      : undefined);

  const heading = duplicateSource
    ? 'Duplikér lønudbetaling'
    : isPaycheckFlow
      ? 'Registrer lønudbetaling'
      : 'Ny indkomst';
  const subline = duplicateSource
    ? 'Alle felter er pre-fyldt fra den valgte post. Tjek datoen - vi har foreslået én måned bagud - og registrér.'
    : isPaycheckFlow
      ? 'Indtast én faktisk udbetaling med dato og beløb. Når der er 3+ udbetalinger registreret, beregner vi forecast for resten af året.'
      : null;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/indkomst"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til indkomst
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          {heading}
        </h1>
        {subline && (
          <p className="mt-1.5 max-w-2xl text-sm text-neutral-500">{subline}</p>
        )}
      </header>

      <div className="mt-6 max-w-2xl">
        {accounts.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Du skal oprette mindst én{' '}
            <Link href="/konti/ny" className="underline">
              konto
            </Link>{' '}
            før du kan tilføje indkomst.
          </div>
        ) : (
          <IncomeForm
            action={createIncome}
            accounts={accounts}
            familyMembers={familyMembers}
            defaultValues={{
              family_member_id: memberId ?? undefined,
              account_id: defaultAccountId,
              recurrence: recurrenceDefault,
              income_role: role,
              // Duplikat-kilden vinder over alt andet - hele rækken kopieres,
              // kun datoen shifts én måned bagud.
              ...(duplicateSource
                ? {
                    amount: duplicateSource.amount,
                    description: duplicateSource.description,
                    occurs_on: previousMonthIso(duplicateSource.occurs_on),
                    gross_amount: duplicateSource.gross_amount,
                    pension_own_pct: duplicateSource.pension_own_pct,
                    pension_employer_pct: duplicateSource.pension_employer_pct,
                    other_deduction_amount: duplicateSource.other_deduction_amount,
                    other_deduction_label: duplicateSource.other_deduction_label,
                    tax_rate_pct: duplicateSource.tax_rate_pct,
                  }
                : {
                    description: isPaycheckFlow ? 'Lønudbetaling' : undefined,
                    // Pre-fyld lønseddel-felter fra seneste udbetaling. Brutto,
                    // pension og trækprocent ændrer sig sjældent - kun dato +
                    // netto behøver brugeren faktisk indtaste hver gang.
                    gross_amount: recentDefaults?.gross_amount,
                    pension_own_pct: recentDefaults?.pension_own_pct,
                    pension_employer_pct: recentDefaults?.pension_employer_pct,
                    other_deduction_amount: recentDefaults?.other_deduction_amount,
                    tax_rate_pct: recentDefaults?.tax_rate_pct,
                  }),
            }}
            submitLabel={
              duplicateSource
                ? 'Registrer kopi'
                : isPaycheckFlow
                  ? 'Registrer lønudbetaling'
                  : 'Opret indkomst'
            }
            cancelHref="/indkomst"
            error={sp.error}
          />
        )}
      </div>
    </div>
  );
}
