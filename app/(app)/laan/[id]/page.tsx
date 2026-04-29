import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getBudgetAccounts, getLoanById } from '@/lib/dal';
import { LoanForm } from '../_components/LoanForm';
import { AmortisationProjection } from '../_components/AmortisationProjection';
import { updateLoan, pushLoanToBudget } from '../actions';
import { ACCOUNT_KIND_LABEL_DA } from '@/lib/format';

export default async function EditLaanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [loan, budgetAccounts] = await Promise.all([
    getLoanById(id),
    getBudgetAccounts(),
  ]);

  const action = updateLoan.bind(null, id);
  const pushAction = pushLoanToBudget.bind(null, id);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/laan"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til lån
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Rediger lån
        </h1>
      </header>

      <div className="mt-6 max-w-2xl">
        <LoanForm
          action={action}
          defaultValues={{
            name: loan.name,
            owner_name: loan.owner_name,
            loan_type: loan.loan_type,
            lender: loan.lender,
            opening_balance: loan.opening_balance,
            original_principal: loan.original_principal,
            payment_amount: loan.payment_amount,
            payment_interval: loan.payment_interval,
            payment_start_date: loan.payment_start_date,
            payment_rente: loan.payment_rente,
            payment_afdrag: loan.payment_afdrag,
            payment_bidrag: loan.payment_bidrag,
            payment_rabat: loan.payment_rabat,
            term_months: loan.term_months,
            interest_rate: loan.interest_rate,
            apr: loan.apr,
          }}
          submitLabel="Gem ændringer"
          cancelHref="/laan"
          error={error}
        />

        <AmortisationProjection loan={loan} />

        <section className="mt-10 rounded-md border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Tilføj som månedlig udgift på budget
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Lægger lånets månedlige ydelse som en tilbagevendende udgift
            (kategori &ldquo;Lån&rdquo;) på den valgte konto. Forudsætter at
            ydelsen er udfyldt ovenfor.
          </p>
          {budgetAccounts.length === 0 ? (
            <p className="mt-3 text-sm text-amber-700">
              Ingen budgetkonti at vælge. Opret en{' '}
              <Link href="/konti/ny" className="underline">
                budgetkonto
              </Link>{' '}
              først.
            </p>
          ) : (
            <form action={pushAction} className="mt-3 flex items-end gap-3">
              <div className="flex-1">
                <label htmlFor="account_id" className="block text-xs font-medium text-neutral-600">
                  Budgetkonto
                </label>
                <select
                  id="account_id"
                  name="account_id"
                  required
                  className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="" disabled>Vælg konto</option>
                  {budgetAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({ACCOUNT_KIND_LABEL_DA[a.kind]})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                Tilføj til budget
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
