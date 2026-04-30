import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AccountForm } from '../_components/AccountForm';
import { createAccount } from '../actions';
import type { AccountKind, SavingsPurpose } from '@/lib/database.types';

const VALID_KINDS: readonly AccountKind[] = [
  'checking', 'budget', 'household', 'savings',
  'investment', 'credit', 'cash', 'other',
];
const VALID_PURPOSES: readonly SavingsPurpose[] = ['buffer', 'predictable_unexpected'];

export default async function NyKontoPage({
  searchParams,
}: {
  // Pre-fyldnings-params understøtter callers som dashboard buffer-CTA og
  // /opsparinger der sender brugeren her med en specifik kontotype/formål
  // i tankerne. savings_purposes kan være kommasepareret ("buffer,predictable_unexpected")
  // hvis brugeren skal oprette én konto til begge formål.
  searchParams: Promise<{
    error?: string;
    kind?: string;
    savings_purposes?: string;
    name?: string;
  }>;
}) {
  const sp = await searchParams;

  const kind = sp.kind && (VALID_KINDS as readonly string[]).includes(sp.kind)
    ? (sp.kind as AccountKind)
    : undefined;

  const savings_purposes = sp.savings_purposes
    ? sp.savings_purposes
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is SavingsPurpose =>
          (VALID_PURPOSES as readonly string[]).includes(s)
        )
    : [];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/konti"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til konti
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Ny konto</h1>
      </header>

      <div className="mt-6 max-w-xl">
        <AccountForm
          action={createAccount}
          defaultValues={{
            name: sp.name,
            kind,
            savings_purposes: savings_purposes.length > 0 ? savings_purposes : undefined,
          }}
          submitLabel="Opret konto"
          cancelHref="/konti"
          error={sp.error}
        />
      </div>
    </div>
  );
}
