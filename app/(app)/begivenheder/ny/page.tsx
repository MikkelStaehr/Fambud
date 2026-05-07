// /begivenheder/ny - oprettelses-form. Trigger fra både NAV_MAIN-listen
// og NAV_TOOLS "Planlæg begivenhed"-genvej.
//
// Post-migration 0059: form'en samler kun event-metadata (navn, type,
// budget, deadline, noter). Tilknytning til en konto sker først når
// brugeren opsætter en månedlig overførsel via /overforsler/ny.

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createLifeEvent } from '../actions';
import { EventForm } from '../_components/EventForm';

type SearchParams = Promise<{ error?: string }>;

export default async function NyBegivenhedPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Link
          href="/begivenheder"
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="h-3 w-3" />
          Tilbage til begivenheder
        </Link>
      </div>
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Ny begivenhed
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Tilføj et planlagt opsparingsmål. Når begivenheden er oprettet,
          kan I opsætte en månedlig overførsel for at aktivere opsparingen.
        </p>
      </header>

      <div className="mt-6 max-w-2xl">
        <EventForm
          action={createLifeEvent}
          submitLabel="Opret begivenhed"
          cancelHref="/begivenheder"
          error={error}
        />
      </div>
    </div>
  );
}
