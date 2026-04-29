import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  getAccounts,
  getFamilyMembers,
  getMostRecentPaycheck,
} from '@/lib/dal';
import { IncomeForm } from '../_components/IncomeForm';
import { createIncome } from '../actions';
import type { IncomeRole, RecurrenceFreq } from '@/lib/database.types';

// Search-params styrer hvilket flow brugeren kommer fra:
//   ?role=primary&recurrence=once&member=X  → "Registrer lønudbetaling"
//     (én faktisk udbetaling der bliver brugt som forecast-sample)
//   default                                 → almindelig "Tilføj indkomst"
//     (uklassificeret eller biindkomst — brugeren vælger frit)
export default async function NyIndkomstPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    role?: string;
    recurrence?: string;
    member?: string;
  }>;
}) {
  const sp = await searchParams;
  const [accounts, familyMembers] = await Promise.all([
    getAccounts(),
    getFamilyMembers(),
  ]);

  const role: IncomeRole | null =
    sp.role === 'primary' || sp.role === 'secondary' ? sp.role : null;
  const isPaycheckFlow = role === 'primary' && sp.recurrence === 'once';
  const recurrenceDefault: RecurrenceFreq | undefined =
    sp.recurrence === 'once' ? 'once' : undefined;

  // I paycheck-flow forsøger vi at hente medlemmets seneste lønudbetaling
  // og pre-fylde brutto, pension, trækprocent, skattefradrag og konto fra
  // den. Det er den ene ting der ændrer sig sjældent — næsten alt undtagen
  // dato + netto er konstant fra måned til måned. Returnerer null hvis det
  // er medlemmets første registrering.
  const recentDefaults =
    isPaycheckFlow && sp.member
      ? await getMostRecentPaycheck(sp.member)
      : null;

  // Default-konto: prefer seneste lønudbetalings konto. Hvis ingen
  // foregående lønudbetaling, foreslå medlemmets lønkonto (kind='checking',
  // oprettet af deres user_id).
  const member = sp.member
    ? familyMembers.find((m) => m.id === sp.member)
    : null;
  const defaultAccountId =
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

  const heading = isPaycheckFlow ? 'Registrer lønudbetaling' : 'Ny indkomst';
  const subline = isPaycheckFlow
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
              family_member_id: sp.member ?? undefined,
              account_id: defaultAccountId,
              recurrence: recurrenceDefault,
              income_role: role,
              description: isPaycheckFlow ? 'Lønudbetaling' : undefined,
              // Pre-fyld lønseddel-felter fra seneste udbetaling. Brutto,
              // pension og trækprocent ændrer sig sjældent — kun dato +
              // netto behøver brugeren faktisk indtaste hver gang.
              gross_amount: recentDefaults?.gross_amount,
              pension_own_pct: recentDefaults?.pension_own_pct,
              pension_employer_pct: recentDefaults?.pension_employer_pct,
              other_deduction_amount: recentDefaults?.other_deduction_amount,
              tax_rate_pct: recentDefaults?.tax_rate_pct,
            }}
            submitLabel={isPaycheckFlow ? 'Registrer lønudbetaling' : 'Opret indkomst'}
            cancelHref="/indkomst"
            error={sp.error}
          />
        )}
      </div>
    </div>
  );
}
