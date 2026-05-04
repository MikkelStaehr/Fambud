import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAccountById } from '@/lib/dal';
import { AccountForm } from '../_components/AccountForm';
import { updateAccount } from '../actions';

export default async function EditKontoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const account = await getAccountById(id);

  // Server action with the row id pre-bound - the form submits a clean FormData.
  const action = updateAccount.bind(null, id);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/konti"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til konti
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Rediger konto
        </h1>
      </header>

      <div className="mt-6 max-w-xl">
        <AccountForm
          action={action}
          defaultValues={{
            name: account.name,
            owner_name: account.owner_name,
            kind: account.kind,
            investment_type: account.investment_type,
            savings_purposes: account.savings_purposes,
            opening_balance: account.opening_balance,
            editable_by_all: account.editable_by_all,
          }}
          submitLabel="Gem ændringer"
          cancelHref="/konti"
          error={error}
        />
      </div>
    </div>
  );
}
