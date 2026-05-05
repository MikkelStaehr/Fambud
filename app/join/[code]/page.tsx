import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signup } from '@/app/signup/actions';
import { DawaAddressInput } from '@/app/_components/DawaAddressInput';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { signOutAndJoin } from './actions';

export default async function JoinByCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { code: codeParam } = await params;
  const { error } = await searchParams;
  const code = decodeURIComponent(codeParam).toUpperCase();

  const supabase = await createClient();

  // SECURITY: Rate limit RPC-kald per IP for at gøre brute-force af
  // invite-koder upraktisk. Vi bruger 'reset_password'-bucket som
  // gør at samme angriber ikke kan splitte sin abuse mellem flere
  // mistænkelige flows.
  const ip = await getClientIp();
  const rateLimitOk = await checkRateLimit(`ip:${ip}`, 'reset_password');
  if (!rateLimitOk) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Fambud</h1>
          <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm text-amber-800">For mange forsøg. Prøv igen om en time.</p>
          </div>
        </div>
      </main>
    );
  }

  // validate_invite_code() is anon-callable. Returns one row with
  // (valid, household_name); household_name is null when valid is false.
  const { data, error: rpcError } = await supabase.rpc('validate_invite_code', {
    code_input: code,
  });
  const result = data?.[0];

  // Treat any RPC error or a non-row response as "invalid".
  const invalid = !!rpcError || !result || !result.valid;

  if (invalid) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Fambud</h1>
          <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-6">
            <h2 className="text-base font-semibold text-red-800">Invitation ikke gyldig</h2>
            <p className="mt-2 text-sm text-red-700">
              Denne invitation er udløbet eller findes ikke.
            </p>
            <p className="mt-1 text-xs text-red-600">Kode: {code}</p>
          </div>
          <Link
            href="/join"
            className="mt-6 inline-block text-sm font-medium text-neutral-900 hover:underline"
          >
            Indtast en anden kode
          </Link>
        </div>
      </main>
    );
  }

  // If the visitor is already logged in we can't sign them up again. Offer to
  // log out and come back to the same code rather than silently redirecting -
  // they need to know what's blocking them.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Fambud</h1>
          <div className="mt-8 rounded-md border border-neutral-200 bg-white p-6 text-left">
            <h2 className="text-base font-semibold text-neutral-900">
              Du er allerede logget ind
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Du er logget ind som{' '}
              <span className="font-medium text-neutral-900">{user.email}</span>. For at bruge
              denne invitation skal du oprette en ny konto.
            </p>
            <form action={signOutAndJoin} className="mt-4">
              <input type="hidden" name="code" value={code} />
              <button
                type="submit"
                className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                Log ud og brug invitation
              </button>
            </form>
          </div>
          <Link
            href="/dashboard"
            className="mt-6 inline-block text-sm font-medium text-neutral-500 hover:underline"
          >
            Tilbage til dashboard
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
          <p className="mt-1 text-sm text-neutral-500">
            Du er inviteret til{' '}
            <span className="font-medium text-neutral-900">
              {result.household_name ?? 'en husstand'}
            </span>
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Kode <span className="font-mono">{code}</span>
          </p>
        </div>

        <form action={signup} className="mt-8 space-y-4">
          <input type="hidden" name="invite_code" value={code} />

          <div>
            <label htmlFor="full_name" className="block text-xs font-medium text-neutral-600">
              Dit fulde navn <span className="text-neutral-400">(valgfrit)</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              placeholder="Mette Hansen"
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
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
            Tilslut husstand
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Har du allerede en konto?{' '}
          <Link href="/login" className="font-medium text-neutral-900 hover:underline">
            Log ind
          </Link>
        </p>
      </div>
    </main>
  );
}
