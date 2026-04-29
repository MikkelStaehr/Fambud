import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAccounts, getCategories, getTransactionById } from '@/lib/dal';
import { TransactionForm } from '../_components/TransactionForm';
import { updateTransaction } from '../actions';

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [transaction, accounts, categories] = await Promise.all([
    getTransactionById(id),
    // Include archived so the dropdown can render the row's existing values.
    getAccounts({ includeArchived: true }),
    getCategories({ includeArchived: true }),
  ]);

  const action = updateTransaction.bind(null, id);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/poster"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til poster
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Rediger post</h1>
      </header>

      <div className="mt-6 max-w-xl">
        <TransactionForm
          action={action}
          accounts={accounts}
          categories={categories}
          defaultValues={{
            account_id: transaction.account_id,
            category_id: transaction.category_id,
            amount: transaction.amount,
            description: transaction.description,
            occurs_on: transaction.occurs_on,
            recurrence: transaction.recurrence,
            recurrence_until: transaction.recurrence_until,
          }}
          submitLabel="Gem ændringer"
          cancelHref="/poster"
          error={error}
        />
      </div>
    </div>
  );
}
