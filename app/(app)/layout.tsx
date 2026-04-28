import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getBudgetAccounts } from '@/lib/dal';
import { SidebarNav } from './_components/SidebarNav';
import { signOut } from './actions';

// Belt-and-braces: the proxy already redirects unauthenticated users to /login
// before this layout renders, but we re-check here so any future direct render
// of an (app) page in tests or RSC streams still gates correctly. We also
// gate the whole app behind the onboarding wizard until setup is complete.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Wizard gate. We don't go through the full DAL here because the (app)
  // layout runs on every page load — keep this query minimal.
  const { data: membership } = await supabase
    .from('family_members')
    .select('setup_completed_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership?.setup_completed_at) redirect('/wizard');

  // Fetched at the layout level so the sidebar can render the user's budget
  // accounts as nested links under the Budget item.
  const budgetAccounts = await getBudgetAccounts();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-200 bg-white px-3 py-4">
        <div className="px-2 pb-6">
          <span className="text-base font-semibold tracking-tight text-neutral-900">
            Fambud
          </span>
        </div>

        <SidebarNav
          budgetAccounts={budgetAccounts.map((a) => ({ id: a.id, name: a.name }))}
        />

        <div className="mt-auto px-1 pt-4">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              <LogOut className="h-4 w-4" />
              Log ud
            </button>
          </form>
          <div className="mt-3 truncate px-2.5 text-xs text-neutral-400">
            {user.email}
          </div>
        </div>
      </aside>

      <main className="flex-1">{children}</main>
    </div>
  );
}
