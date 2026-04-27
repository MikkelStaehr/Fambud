import { redirect } from 'next/navigation';
import { getHouseholdContext, getMyMembership } from '@/lib/dal';
import { IncomeForm } from './_components/IncomeForm';
import { createMonthlyIncome } from './actions';

export default async function WizardIndkomstPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const { membership } = await getMyMembership();
  const isOwner = membership?.role === 'owner';
  const totalSteps = isOwner ? 7 : 5;
  const skipHref = '/wizard/privat-opsparing';

  // Find the user's personal account (the one they just created in step 1).
  // If they got here without one — e.g. by typing the URL — bounce back.
  const { supabase, user } = await getHouseholdContext();
  const { data: myAccount } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!myAccount) {
    redirect('/wizard/lonkonto');
  }

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Trin 2 af {totalSteps}
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
        Lønudbetaling
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Tilføj din månedsløn så cashflowet allerede er rigtigt fra start. Du kan
        altid hoppe over og tilføje den senere.
      </p>

      <div className="mt-6">
        <IncomeForm
          action={createMonthlyIncome}
          accountId={myAccount.id}
          accountName={myAccount.name}
          skipHref={skipHref}
          error={error}
        />
      </div>
    </div>
  );
}
