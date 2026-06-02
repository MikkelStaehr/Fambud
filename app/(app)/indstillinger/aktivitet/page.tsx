// /indstillinger/aktivitet - husstands-aktivitets-log.
//
// Viser de seneste 100 hændelser i husstanden: transaktioner ændret/slettet,
// konti og lån redigeret, familie-medlemskab, proxy-flow. Hver række er
// formateret som læsbar prose med en "vis detaljer"-toggle for det rå
// metadata-objekt.
//
// Login/password/signup-events ligger UDENFOR scope - de er pre-husstand
// og hører hjemme i operator-dashboardet (Supabase Dashboard direkte).

import { Goal } from 'lucide-react';
import { getHouseholdActivity } from '@/lib/dal';
import { ActivityRow } from './_components/ActivityRow';

export default async function AktivitetPage() {
  const rows = await getHouseholdActivity({ limit: 100 });

  return (
    <div>
      <p className="max-w-2xl text-sm text-neutral-500">
        De seneste {rows.length} hændelser i jeres husstand - ændringer på
        konti, lån, transaktioner, familie-medlemskab og hjælper-flow.
        Login og password-hændelser ligger ikke her.
      </p>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-neutral-200 bg-white px-6 py-12 text-center">
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
