import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAccounts, getTransferById } from '@/lib/dal';
import { TransferForm } from '../_components/TransferForm';
import { updateTransfer } from '../actions';

export default async function EditOverforselPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [transfer, accounts] = await Promise.all([
    getTransferById(id),
    getAccounts({ includeArchived: true }),
  ]);

  const action = updateTransfer.bind(null, id);

  return (
    <div className="px-8 py-6">
      <Link
        href="/overforsler"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til overførsler
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Rediger overførsel
        </h1>
      </header>

      <div className="mt-6 max-w-xl">
        <TransferForm
          action={action}
          accounts={accounts}
          defaultValues={{
            from_account_id: transfer.from_account_id,
            to_account_id: transfer.to_account_id,
            amount: transfer.amount,
            description: transfer.description,
            occurs_on: transfer.occurs_on,
            recurrence: transfer.recurrence,
            recurrence_until: transfer.recurrence_until,
          }}
          submitLabel="Gem ændringer"
          cancelHref="/overforsler"
          error={error}
        />
      </div>
    </div>
  );
}
