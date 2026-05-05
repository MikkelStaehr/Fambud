import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { setNewPassword } from './actions';
import { SubmitButton } from '@/app/_components/SubmitButton';

export default async function NytKodeordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Side er kun nyttig for authenticated brugere (recovery-session fra
  // mail-link, eller en allerede-logget-ind bruger der vil skifte
  // adgangskode). Ikke-loggede ryger til glemt-kodeord-flowet i stedet.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/glemt-kodeord');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Fambud</h1>
          <p className="mt-1 text-sm text-neutral-500">Vælg ny adgangskode</p>
        </div>

        <form action={setNewPassword} className="mt-8 space-y-4">
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-neutral-600">
              Ny adgangskode
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <p className="mt-1 text-xs text-neutral-500">Mindst 8 tegn.</p>
          </div>

          <div>
            <label
              htmlFor="password_confirm"
              className="block text-xs font-medium text-neutral-600"
            >
              Gentag ny adgangskode
            </label>
            <input
              id="password_confirm"
              name="password_confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <SubmitButton pendingText="Gemmer...">Gem ny adgangskode</SubmitButton>
        </form>
      </div>
    </main>
  );
}
