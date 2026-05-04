import Link from 'next/link';
import { ArrowLeft, Wand2 } from 'lucide-react';
import { getAccounts } from '@/lib/dal';
import { TransferForm } from '../_components/TransferForm';
import { createTransfer } from '../actions';
import { parseAmountToOere } from '@/lib/format';
import type { RecurrenceFreq } from '@/lib/database.types';

const VALID_FREQS = new Set<RecurrenceFreq>([
  'once',
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
]);

// Pre-fill query params kommer typisk fra CashflowAdvisor's "Opret denne
// overførsel"-knap (med konkret fix). Vi validerer hver param defensivt -
// en bruger med en dårligt-kopieret URL skal ikke få en ødelagt form.
function readPrefill(
  sp: Record<string, string | undefined>,
  validAccountIds: Set<string>
): {
  from?: string;
  to?: string;
  amount?: number;
  recurrence?: RecurrenceFreq;
  description?: string;
} {
  const from = sp.from && validAccountIds.has(sp.from) ? sp.from : undefined;
  const to = sp.to && validAccountIds.has(sp.to) && sp.to !== from ? sp.to : undefined;
  const amount = sp.amount ? parseAmountToOere(sp.amount) ?? undefined : undefined;
  const recurrence =
    sp.recurrence && VALID_FREQS.has(sp.recurrence as RecurrenceFreq)
      ? (sp.recurrence as RecurrenceFreq)
      : undefined;
  const description = sp.description?.trim() || undefined;
  return { from, to, amount, recurrence, description };
}

export default async function NyOverforselPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    from?: string;
    to?: string;
    amount?: string;
    recurrence?: string;
    description?: string;
  }>;
}) {
  const sp = await searchParams;
  const accounts = await getAccounts();

  const validIds = new Set(accounts.map((a) => a.id));
  const prefill = readPrefill(sp, validIds);
  const isPrefilled = prefill.from && prefill.to && prefill.amount != null;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/overforsler"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til overførsler
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Ny overførsel
        </h1>
      </header>

      <div className="mt-6 max-w-xl">
        {accounts.length < 2 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Du skal have mindst to{' '}
            <Link href="/konti" className="underline">
              konti
            </Link>{' '}
            for at oprette en overførsel.
          </div>
        ) : (
          <>
            {isPrefilled && (
              <div className="mb-4 inline-flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Vi har pre-udfyldt formularen baseret på vores forslag - tjek
                  det igennem og tryk Opret når det ser rigtigt ud.
                </span>
              </div>
            )}
            <TransferForm
              action={createTransfer}
              accounts={accounts}
              defaultValues={{
                from_account_id: prefill.from,
                to_account_id: prefill.to,
                amount: prefill.amount,
                recurrence: prefill.recurrence,
                description: prefill.description,
              }}
              submitLabel="Opret overførsel"
              cancelHref="/overforsler"
              error={sp.error}
            />
          </>
        )}
      </div>
    </div>
  );
}
