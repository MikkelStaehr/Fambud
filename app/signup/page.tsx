import Link from 'next/link';
import { signup } from './actions';
import { DawaAddressInput } from '@/app/_components/DawaAddressInput';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; step?: string; email?: string }>;
}) {
  const { error, step, email } = await searchParams;

  if (step === 'check-email') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Fambud</h1>

          <div className="mt-8 rounded-md border border-neutral-200 bg-white p-6">
            <h2 className="text-base font-semibold text-neutral-900">Bekræft din email</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Vi har sendt en bekræftelsesmail til{' '}
              <span className="font-medium text-neutral-900">{email}</span>.
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              Klik på linket i mailen for at aktivere din konto.
            </p>
          </div>

          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-neutral-900 hover:underline"
          >
            Gå til login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Fambud</h1>
          <p className="mt-1 text-sm text-neutral-500">Opret din husstand</p>
        </div>

        <form action={signup} className="mt-8 space-y-4">
          <div>
            <label htmlFor="household_name" className="block text-xs font-medium text-neutral-600">
              Husstandens navn <span className="text-neutral-400">(valgfrit)</span>
            </label>
            <input
              id="household_name"
              name="household_name"
              type="text"
              placeholder="Familien Hansen"
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label htmlFor="full_name" className="block text-xs font-medium text-neutral-600">
              Dit fulde navn <span className="text-neutral-400">(valgfrit)</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              placeholder="Anders Hansen"
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Vises i dashboardet og på familielisten
            </p>
          </div>

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
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <DawaAddressInput
            legend="Bopælsadresse (valgfrit)"
            namePrefix="home"
            hint="Bruges til kommune-baserede ydelser senere - du kan altid redigere det under Indstillinger."
          />

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-neutral-600">
              Adgangskode
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <p className="mt-1 text-xs text-neutral-500">Mindst 6 tegn</p>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Opret konto
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Har du allerede en konto?{' '}
          <Link href="/login" className="font-medium text-neutral-900 hover:underline">
            Log ind
          </Link>
        </p>

        <p className="mt-2 text-center text-xs text-neutral-400">
          Har du fået en invitationskode?{' '}
          <Link href="/join" className="font-medium text-neutral-600 hover:underline">
            Tilslut en husstand
          </Link>
        </p>
      </div>
    </main>
  );
}
