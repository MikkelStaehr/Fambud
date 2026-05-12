import Link from 'next/link';
import { requestPasswordReset } from './actions';
import { FambudMark } from '@/app/_components/FambudMark';
import { SubmitButton } from '@/app/_components/SubmitButton';
import { readAuthStepCookie } from '@/lib/auth-step';

export default async function GlemtKodeordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Check-email-state via HttpOnly-cookie - emailen kommer ikke i URL'en.
  const authStep = await readAuthStepCookie();

  if (authStep?.step === 'check-email') {
    const email = authStep.email;
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <FambudMark size="lg" />

          <div className="mt-8 rounded-md border border-neutral-200 bg-white p-6">
            <h2 className="text-base font-semibold text-neutral-900">Tjek din email</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Hvis der findes en konto med{' '}
              <span className="font-medium text-neutral-900">{email}</span>, har vi
              sendt et link til at nulstille adgangskoden.
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              Linket udløber efter 1 time.
            </p>
          </div>

          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-neutral-900 hover:underline"
          >
            Tilbage til login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <FambudMark size="lg" />
          <p className="mt-1 text-sm text-neutral-500">Glemt adgangskode?</p>
        </div>

        <p className="mt-6 text-sm text-neutral-600">
          Indtast din email, så sender vi et link til at nulstille din adgangskode.
        </p>

        <form action={requestPasswordReset} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-neutral-600">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <SubmitButton pendingText="Sender link...">Send link</SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Husker du den alligevel?{' '}
          <Link href="/login" className="font-medium text-neutral-900 hover:underline">
            Log ind
          </Link>
        </p>
      </div>
    </main>
  );
}
