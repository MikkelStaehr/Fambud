import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LoanForm } from '../_components/LoanForm';
import { createLoan } from '../actions';

export default async function NyLaanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
          Nyt lån
        </h1>
      </header>

      <div className="mt-6 max-w-2xl">
        <LoanForm
          action={createLoan}
          submitLabel="Opret lån"
          cancelHref="/laan"
          error={error}
        />
      </div>
    </div>
  );
}
