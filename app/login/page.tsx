import Link from 'next/link';
import { login } from './actions';
import { SubmitButton } from '@/app/_components/SubmitButton';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Fambud</h1>
          <p className="mt-1 text-sm text-neutral-500">Log ind på din konto</p>
        </div>

        <form action={login} className="mt-8 space-y-4">
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

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className="block text-xs font-medium text-neutral-600">
                Adgangskode
              </label>
              <Link
                href="/glemt-kodeord"
                className="text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:underline"
              >
                Glemt adgangskode?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700 select-none">
            <input
              type="checkbox"
              name="remember_me"
              defaultChecked
              className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
            />
            Husk mig
          </label>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <SubmitButton pendingText="Logger ind...">Log ind</SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Har du ikke en konto?{' '}
          <Link href="/signup" className="font-medium text-neutral-900 hover:underline">
            Opret en
          </Link>
        </p>
      </div>
    </main>
  );
}
