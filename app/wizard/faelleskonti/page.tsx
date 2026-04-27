import Link from 'next/link';
import { redirect } from 'next/navigation';
import { X } from 'lucide-react';
import { getHouseholdContext, getMyMembership } from '@/lib/dal';
import { ACCOUNT_KIND_LABEL_DA } from '@/lib/format';
import { SharedAccountForm } from './_components/SharedAccountForm';
import { createSharedAccount, removeSharedAccount } from './actions';

export default async function WizardFaelleskontiPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Partner shouldn't reach this step. If they manage to navigate here, send
  // them to /done instead of showing owner-only content.
  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect('/wizard/done');
  }

  // List shared accounts already created — anything with owner_name='Fælles'
  // we treat as a shared account for the wizard's purposes.
  const { supabase, householdId, user } = await getHouseholdContext();
  const { data: shared } = await supabase
    .from('accounts')
    .select('id, name, kind')
    .eq('household_id', householdId)
    .eq('created_by', user.id)
    .eq('owner_name', 'Fælles')
    .order('created_at', { ascending: true });

  const count = shared?.length ?? 0;

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Trin 4 af 7
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
        Fælleskonti
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Opret de konti I deler — typisk en budgetkonto til faste regninger
        (husleje, el, forsikringer) og en husholdningskonto til daglig handel.
        Tilføj så mange du vil, eller hop over.
      </p>

      {count > 0 && (
        <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
          {shared!.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between border-b border-neutral-100 px-4 py-2 text-sm last:border-b-0"
            >
              <div>
                <span className="font-medium text-neutral-900">{a.name}</span>
                <span className="ml-2 text-xs text-neutral-500">
                  {ACCOUNT_KIND_LABEL_DA[a.kind] ?? a.kind}
                </span>
              </div>
              <form action={removeSharedAccount}>
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  className="rounded p-1 text-neutral-300 transition hover:bg-red-50 hover:text-red-700"
                  title="Fjern konto"
                  aria-label={`Fjern ${a.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <SharedAccountForm
          action={createSharedAccount}
          resetKey={count}
          error={error}
        />
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        Du kan tilføje så mange du vil. Klik <span className="text-neutral-700">Næste</span> når du er færdig.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/wizard/kredit-laan"
          className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Næste
        </Link>
        {count === 0 && (
          <Link
            href="/wizard/kredit-laan"
            className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Hop over
          </Link>
        )}
      </div>
    </div>
  );
}
