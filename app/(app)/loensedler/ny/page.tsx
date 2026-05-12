// /loensedler/ny - registrer ny lønseddel.

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getPayslipLabelMap } from '@/lib/dal';
import { createPayslip } from '../actions';
import { PayslipForm } from '../_components/PayslipForm';

type SearchParams = Promise<{ error?: string }>;

export default async function NyLoensedelPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;
  const labelMap = await getPayslipLabelMap();

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Link
          href="/loensedler"
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="h-3 w-3" />
          Tilbage til lønsedler
        </Link>
      </div>
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Registrer lønseddel
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Skriv de poster du har på lønsedlen ind som linjer. Vi husker
          dine klassifikationer, så det går hurtigere næste måned.
        </p>
      </header>

      <div className="mt-6 max-w-3xl">
        <PayslipForm
          action={createPayslip}
          labelMap={labelMap}
          submitLabel="Gem lønseddel"
          cancelHref="/loensedler"
          error={error}
        />
      </div>
    </div>
  );
}
