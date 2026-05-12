import Link from 'next/link';
import { signup } from './actions';
import { DawaAddressInput } from '@/app/_components/DawaAddressInput';
import { FambudMark } from '@/app/_components/FambudMark';
import { SubmitButton } from '@/app/_components/SubmitButton';
import { readAuthStepCookie } from '@/lib/auth-step';
import { LandingTokenField } from './_components/LandingTokenField';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Check-email-state bæres via HttpOnly-cookie i stedet for URL-param.
  // Det undgår at brugerens email ender i browser-historik / Vercel-logs
  // / referrer-headers efter signup.
  const authStep = await readAuthStepCookie();

  if (authStep?.step === 'check-email') {
    const email = authStep.email;
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <FambudMark size="lg" />

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
          <FambudMark size="lg" />
          <p className="mt-1 text-sm text-neutral-500">Opret din husstand</p>
        </div>

        <form action={signup} className="mt-8 space-y-4">
          {/* Skjult conversion-token fra landing-flow. Sat fra localStorage
              hvis brugeren kom via "Find ud af det selv"-flowet. */}
          <LandingTokenField />
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
              minLength={8}
              autoComplete="new-password"
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <p className="mt-1 text-xs text-neutral-500">Mindst 8 tegn</p>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <p className="text-xs text-neutral-600 leading-relaxed">
            Ved at oprette konto bekræfter du at have læst vores{' '}
            <Link href="/privatliv" className="font-medium text-neutral-900 underline hover:text-emerald-800">
              privatlivspolitik
            </Link>{' '}
            og accepterer behandling af dine data som beskrevet deri.
          </p>

          <SubmitButton pendingText="Opretter konto...">Opret konto</SubmitButton>
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
