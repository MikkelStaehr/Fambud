import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAccounts } from '@/lib/dal';
import { TransferForm } from '../_components/TransferForm';
import { createTransfer } from '../actions';

export default async function NyOverforselPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const accounts = await getAccounts();

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
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Ny overførsel</h1>
      </header>

      <div className="mt-6 max-w-xl">
        {accounts.length < 2 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Du skal have mindst to{' '}
            <Link href="/konti" className="underline">konti</Link> for at oprette en overførsel.
          </div>
        ) : (
          <TransferForm
            action={createTransfer}
            accounts={accounts}
            submitLabel="Opret overførsel"
            cancelHref="/overforsler"
            error={error}
          />
        )}
      </div>
    </div>
  );
}
