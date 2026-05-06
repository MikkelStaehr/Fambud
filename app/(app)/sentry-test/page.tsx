// MIDLERTIDIG TEST-FIXTURE - skal slettes efter Sentry-end-to-end er
// verificeret. Tre fejl-paths så vi kan bekræfte at:
//   1. RSC/server-component-fejl fanges (?trigger=server)
//   2. Client-side runtime-fejl fanges (knap nedenfor)
//   3. Server Action-fejl fanges (form-submit nedenfor)
//
// Auth-gated via (app)/-layout. Selv en authenticated angriber kan max
// trigge fejl i deres egen session - ingen DoS-risiko ud over deres
// egen rate-limit. Hvis vi efterlader filen i koden permanent, bør den
// dog slettes efter vi har bekræftet PII-redaction virker, så vi ikke
// generer Sentry-quota for ingenting.
//
// Slet med: git rm -r app/\(app\)/sentry-test/
import { TestClientButton } from './TestClientButton';

export default async function SentryTestPage({
  searchParams,
}: {
  searchParams: Promise<{ trigger?: string }>;
}) {
  const { trigger } = await searchParams;

  // Server-component-fejl: kastes på render. Sentry's onRequestError
  // (re-exporteret i instrumentation.ts) fanger den.
  if (trigger === 'server') {
    throw new Error(`Sentry server-test ${new Date().toISOString()}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">Sentry-test</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Tre fejl-paths til end-to-end-verifikation. Vent 1-2 minutter
        efter trigger og tjek Sentry Dashboard → Issues. Slet denne
        side når PII-redaction er bekræftet.
      </p>

      <ol className="mt-8 space-y-6">
        <li>
          <h2 className="font-medium text-neutral-900">1. Server-component fejl</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Kastes ved render af RSC. Test af{' '}
            <code className="font-mono text-xs">onRequestError</code>-hooket.
          </p>
          <a
            href="?trigger=server"
            className="mt-2 inline-block rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
          >
            Trigger server-fejl
          </a>
        </li>

        <li>
          <h2 className="font-medium text-neutral-900">2. Client-runtime fejl</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Kastes i browseren. Test af client-init i{' '}
            <code className="font-mono text-xs">instrumentation-client.ts</code>.
          </p>
          <TestClientButton />
        </li>

        <li>
          <h2 className="font-medium text-neutral-900">3. Server Action fejl</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Kastes i en Server Action. Test af action-fejl-path (mest
            relevant da det er FamBud's hyppigste fejl-vektor).
          </p>
          <form action={triggerActionError}>
            <button
              type="submit"
              className="mt-2 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
            >
              Trigger Server Action-fejl
            </button>
          </form>
        </li>
      </ol>

      <hr className="mt-12 border-neutral-200" />
      <p className="mt-4 text-xs text-neutral-500">
        Når alle tre paths er verificeret i Sentry og PII er bekræftet
        strippet:{' '}
        <code className="font-mono">git rm -r app/(app)/sentry-test/</code>
      </p>
    </div>
  );
}

async function triggerActionError() {
  'use server';
  throw new Error(`Sentry server-action-test ${Date.now()}`);
}
