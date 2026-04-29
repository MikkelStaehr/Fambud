import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAccounts, getFamilyMembers, getIncomeById } from '@/lib/dal';
import { IncomeForm } from '../_components/IncomeForm';
import { updateIncome } from '../actions';

export default async function EditIndkomstPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [income, accounts, familyMembers] = await Promise.all([
    getIncomeById(id),
    getAccounts({ includeArchived: true }),
    getFamilyMembers(),
  ]);

  const action = updateIncome.bind(null, id);

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
          Rediger indkomst
        </h1>
      </header>

      <div className="mt-6 max-w-2xl">
        <IncomeForm
          action={action}
          accounts={accounts}
          familyMembers={familyMembers}
          defaultValues={{
            family_member_id: income.family_member_id,
            account_id: income.account_id,
            amount: income.amount,
            description: income.description,
            occurs_on: income.occurs_on,
            recurrence: income.recurrence,
            recurrence_until: income.recurrence_until,
            gross_amount: income.gross_amount,
            pension_own_pct: income.pension_own_pct,
            pension_employer_pct: income.pension_employer_pct,
            other_deduction_amount: income.other_deduction_amount,
            other_deduction_label: income.other_deduction_label,
          }}
          submitLabel="Gem ændringer"
          cancelHref="/indkomst"
          error={error}
        />
      </div>
    </div>
  );
}
