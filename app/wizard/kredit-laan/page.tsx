import Link from 'next/link';
import { X } from 'lucide-react';
import { getHouseholdContext, getMyMembership } from '@/lib/dal';
import { formatAmount } from '@/lib/format';
import { CreditLoanForm } from './_components/CreditLoanForm';
import { createCreditLoan, removeCreditLoan } from './actions';

export default async function WizardKreditLaanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const { membership } = await getMyMembership();
  const isOwner = membership?.role === 'owner';
  const totalSteps = isOwner ? 7 : 4;
  const stepNumber = isOwner ? 5 : 3;
  // Owner continues to invite; partner skips to done.
  const nextHref = isOwner ? '/wizard/invite' : '/wizard/done';

  // List credit/loan accounts already added by this user. Filter by
  // created_by + kind so we don't show owner's stuff to partner or vice versa.
  const { supabase, user } = await getHouseholdContext();
  const { data: existing } = await supabase
    .from('accounts')
    .select('id, name, owner_name, opening_balance, interest_rate, apr')
    .eq('created_by', user.id)
    .eq('kind', 'credit')
    .order('created_at', { ascending: true });

  const count = existing?.length ?? 0;

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Trin {stepNumber} af {totalSteps}
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
        Kredit, lån & realkredit
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Kreditkort, kassekreditter, banklån og realkreditlån — alt der har en
        rente og en gæld at holde øje med. Tilføj så mange du vil, eller hop over.
      </p>

      {count > 0 && (
        <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
          {existing!.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between border-b border-neutral-100 px-4 py-2 text-sm last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                  {a.name}
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-normal ${
                      a.owner_name === 'Fælles'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {a.owner_name === 'Fælles' ? 'Fælles' : 'Personlig'}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
                  <span className="tabnum font-mono">
                    {formatAmount(a.opening_balance)} kr.
                  </span>
                  {a.interest_rate != null && (
                    <>
                      <span className="text-neutral-300">·</span>
                      <span>Rente {a.interest_rate.toFixed(2)}%</span>
                    </>
                  )}
                  {a.apr != null && (
                    <>
                      <span className="text-neutral-300">·</span>
                      <span>ÅOP {a.apr.toFixed(2)}%</span>
                    </>
                  )}
                </div>
              </div>
              <form action={removeCreditLoan}>
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  className="rounded p-1 text-neutral-300 transition hover:bg-red-50 hover:text-red-700"
                  title="Fjern"
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
        <CreditLoanForm action={createCreditLoan} resetKey={count} error={error} />
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        Du kan tilføje så mange du vil. Klik <span className="text-neutral-700">Næste</span> når du er færdig.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Link
          href={nextHref}
          className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Næste
        </Link>
        {count === 0 && (
          <Link
            href={nextHref}
            className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Hop over
          </Link>
        )}
      </div>
    </div>
  );
}
