import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAccounts, getCategories } from '@/lib/dal';
import { TransactionForm } from '../_components/TransactionForm';
import { createTransaction } from '../actions';

export default async function NyPostPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [accounts, categories] = await Promise.all([
    getAccounts(),
    getCategories(),
  ]);

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
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Ny post</h1>
      </header>

      <div className="mt-6 max-w-xl">
        {accounts.length === 0 || categories.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {accounts.length === 0 && (
              <p>
                Du skal oprette mindst én <Link href="/konti/ny" className="underline">konto</Link>{' '}
                før du kan oprette poster.
              </p>
            )}
            {categories.length === 0 && (
              <p className="mt-1">
                Du skal oprette mindst én{' '}
                <Link href="/indstillinger" className="underline">kategori</Link> før du kan oprette poster.
              </p>
            )}
          </div>
        ) : (
          <TransactionForm
            action={createTransaction}
            accounts={accounts}
            categories={categories}
            submitLabel="Opret post"
            cancelHref="/poster"
            error={error}
          />
        )}
      </div>
    </div>
  );
}
