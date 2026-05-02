import Link from 'next/link';
import { joinByCode } from './actions';

export default async function JoinPage({
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
          <p className="mt-1 text-sm text-neutral-500">Tilslut en husstand</p>
        </div>

        <form action={joinByCode} className="mt-8 space-y-4">
          <div>
            <label htmlFor="code" className="block text-xs font-medium text-neutral-600">
              Invitationskode
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={16}
              placeholder="ABCD2345"
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-center font-mono text-base tracking-widest uppercase placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
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
            Fortsæt
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Vil du oprette en ny husstand i stedet?{' '}
          <Link href="/signup" className="font-medium text-neutral-900 hover:underline">
            Opret konto
          </Link>
        </p>
      </div>
    </main>
  );
}
