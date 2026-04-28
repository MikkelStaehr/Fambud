import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAccounts, getFamilyMembers } from '@/lib/dal';
import { IncomeForm } from '../_components/IncomeForm';
import { createIncome } from '../actions';

export default async function NyIndkomstPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [accounts, familyMembers] = await Promise.all([
    getAccounts(),
    getFamilyMembers(),
  ]);

  return (
    <div className="px-8 py-6">
      <Link
        href="/indkomst"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til indkomst
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Tilføj indkomst
        </h1>
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
            submitLabel="Opret indkomst"
            cancelHref="/indkomst"
            error={error}
          />
        )}
      </div>
    </div>
  );
}
