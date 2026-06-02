// /indstillinger/aktivitet - husstands-aktivitets-log.
//
// Viser de seneste 100 hændelser i husstanden: transaktioner ændret/slettet,
// konti og lån redigeret, familie-medlemskab, proxy-flow. Hver række er
// formateret som læsbar prose med en "vis detaljer"-toggle for det rå
// metadata-objekt.
//
// Login/password/signup-events ligger UDENFOR scope - de er pre-husstand
// og hører hjemme i operator-dashboardet (Supabase Dashboard direkte).

import Link from 'next/link';
import { ArrowLeft, Goal } from 'lucide-react';
import { getHouseholdActivity } from '@/lib/dal';
import { ActivityRow } from './_components/ActivityRow';

export default async function AktivitetPage() {
  const rows = await getHouseholdActivity({ limit: 100 });

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/indstillinger"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til indstillinger
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Aktivitet
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          De seneste {rows.length} hændelser i jeres husstand - ændringer på
          konti, lån, transaktioner, familie-medlemskab og hjælper-flow.
          Login og password-hændelser ligger ikke her.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-md border border-dashed border-neutral-200 bg-white px-6 py-12 text-center">
          <Goal className="mx-auto h-6 w-6 text-neutral-300" />
          <p className="mt-3 text-sm text-neutral-500">
            Ingen aktivitet endnu. Når I ændrer transaktioner, konti, lån
            eller familie-medlemskab, dukker det op her som et evidens-spor.
          </p>
        </div>
      ) : (
        <section className="mt-6 rounded-md border border-neutral-200 bg-white">
          <ul className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <ActivityRow key={row.id} row={row} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
