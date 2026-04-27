import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ensureStandardExpenseCategories, getBudgetAccounts } from '@/lib/dal';

// Entry. Idempotently seeds the eight standard expense categories, then
// jumps to the first relevant account so the user lands directly in the
// first step of the per-account flow.
export default async function BudgetEntryPage() {
  await ensureStandardExpenseCategories();

  const accounts = await getBudgetAccounts();
  if (accounts.length > 0) {
    redirect(`/budget/${accounts[0].id}`);
  }

  return (
    <div className="px-8 py-6">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">Budget</h1>
      </header>
      <div className="mt-8 max-w-xl rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Du har ingen budget-relevante konti endnu. Opret en{' '}
        <span className="font-medium">Budgetkonto</span> eller{' '}
        <span className="font-medium">Husholdningskonto</span> via{' '}
        <Link href="/konti/ny" className="underline">Konti</Link> først.
      </div>
    </div>
  );
}
